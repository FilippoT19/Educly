/**
 * parse-markdown.ts
 *
 * Parses a Markdown file (converted from a math textbook PDF) and extracts:
 *   - esempi (worked examples, difficulty=0)
 *   - exercises (numbered exercises, optionally starred)
 *   - applications (real-world application exercises)
 *
 * Handles the following file structure:
 *   ## Esempi svolti → Esempio 1.1. ... Esempio 1.4.
 *   ## Esercizi → 1.1. ★ / 1.2. / ## 1.8. / ### 1.11. ★
 *   ### 1.1.B. Applicazioni → ## CategoryTitle / 1.43. / 1.44. *
 *   ## Soluzioni § 1.1 → 1.1. a. ... / 1.2. a. ...
 *
 * Usage:
 *   npx ts-node scripts/parse-markdown.ts <file.md> \
 *     [--subject analisi2] \
 *     [--source eserciziario] \
 *     [--chapter "Cap. 1. Equazioni differenziali"] \
 *     [--subtopic "1.1.A"]
 *
 * Output:
 *   scripts/output/<filename>.json  — upload-ready JSON
 *   scripts/output/<filename>.html  — visual preview
 */

import * as fs from "fs";
import * as path from "path";
import katex from "katex";

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const get = (flag: string, def: string | null = null): string | null => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : def;
  };
  return {
    file,
    subject: get("--subject") ?? "analisi2",
    source: get("--source") ?? "eserciziario",
    chapter: get("--chapter"),
    subtopic: get("--subtopic"),
    book: get("--book"),
    author: get("--author"),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Part {
  label: string;            // "a", "b", "c"
  question_latex: string;
  solution_latex: string | null;
}

export interface ParsedItem {
  number: string;                              // "1.1", "1.43"
  exercise_type: "exercise" | "esempio" | "application";
  has_star: boolean;
  question_latex: string;                      // full question (single-part) or shared preamble (multi-part)
  solution_latex: string | null;               // full solution (single-part only), null for multi-part
  parts: Part[];                               // empty for single-part exercises
  subtopic_id: string | null;                  // e.g. "1.1.A"
  application_category: string | null;         // e.g. "Modelli di crescita ed estinzione"
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Remove Markdown footnote anchors like [^0], [^12] from text. */
function stripFootnotes(text: string): string {
  return text.replace(/\[\^\d+\]/g, "").trim();
}

/**
 * Detect "starred" exercises. The source PDF uses several representations:
 *   ★  ⊛  *  \&  K
 * All mean "starred — full worked solution exists".
 */
function detectStar(line: string): boolean {
  // ★ or ⊛ (direct Unicode)
  if (/[★⊛]/.test(line)) return true;
  // Plain asterisk * NOT inside LaTeX (not preceded by \)
  if (/(?<!\\)\*/.test(line)) return true;
  // Escaped ampersand \& used in some PDF conversions
  if (/\\&/.test(line)) return true;
  // Standalone K used as star variant (e.g. "### 1.23. K")
  if (/\bK\b/.test(line)) return true;
  return false;
}

/**
 * Split a block of text into a preamble and labelled parts (a., b., c. …).
 *
 * Rules:
 *   - A line that starts with a single lowercase letter a-e followed by ". "
 *     begins a new part — BUT only when not inside a $$ math block.
 *   - Everything before the first part is the preamble.
 *   - Parts (a)/b) style are NOT split — only "a. " at line start.
 */
function splitIntoParts(text: string): { preamble: string; parts: Array<{ label: string; text: string }> } {
  const lines = text.split("\n");
  const preambleLines: string[] = [];
  const partBlocks: Array<{ label: string; lines: string[] }> = [];
  let inMath = false;
  let current: { label: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Toggle math block state on lines that are solely "$$"
    if (trimmed === "$$") {
      inMath = !inMath;
    }

    // Part detector: "a. " or "a." alone at line start, outside math blocks.
    // Allows trailing space OR end-of-line (e.g. "b." on its own line in solutions).
    const partMatch = !inMath && line.match(/^([a-e])\.(\s|$)/);
    if (partMatch) {
      if (current) partBlocks.push(current);
      current = { label: partMatch[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  }
  if (current) partBlocks.push(current);

  return {
    preamble: preambleLines.join("\n").trim(),
    parts: partBlocks.map((b) => ({ label: b.label, text: b.lines.join("\n").trim() })),
  };
}

// ── Block identification ───────────────────────────────────────────────────────

interface BlockBounds {
  esempiStart: number;
  esempiEnd: number;
  exercisesStart: number;
  applicationsStart: number;
  applicationsSubtopic: string | null;  // e.g. "1.1.B" extracted from "### 1.1.B. Applicazioni"
  soluzioniStart: number;
}

function identifyBlocks(lines: string[]): BlockBounds {
  let esempiStart = -1;
  let esempiEnd = -1;
  let exercisesStart = -1;
  let applicationsStart = -1;
  let applicationsSubtopic: string | null = null;
  let soluzioniStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "## Esempi svolti" && esempiStart === -1) {
      esempiStart = i + 1;
      continue;
    }
    if (line === "## Esercizi" && exercisesStart === -1) {
      exercisesStart = i + 1;
      if (esempiStart !== -1 && esempiEnd === -1) esempiEnd = i;
      continue;
    }
    // Section headings like "### 1.1.B. Applicazioni" or "### 1.2.E. Applicazioni fisiche"
    // Only treat as applications if the heading contains "Applicazioni"
    const appMatch = line.match(/^#{2,3}\s+(\d+\.\d+\.[A-Z])\./);
    if (appMatch && line.includes("Applicazioni") && applicationsStart === -1) {
      applicationsStart = i + 1;
      applicationsSubtopic = appMatch[1];  // e.g. "1.1.B" or "1.2.E"
      continue;
    }
    if (/^##\s+Soluzioni/.test(line) && soluzioniStart === -1) {
      soluzioniStart = i + 1;
      continue;
    }
  }

  // Fallback: if no applications section, exercises go all the way to solutions
  if (applicationsStart === -1) applicationsStart = soluzioniStart !== -1 ? soluzioniStart : lines.length;
  if (soluzioniStart === -1) soluzioniStart = lines.length;
  if (esempiEnd === -1) esempiEnd = exercisesStart !== -1 ? exercisesStart : lines.length;

  return { esempiStart, esempiEnd, exercisesStart, applicationsStart, applicationsSubtopic, soluzioniStart };
}

// ── Exercise number detection ──────────────────────────────────────────────────

/**
 * Try to match an exercise number from a line.
 * Matches: "1.1. ★", "## 1.8.", "### 1.11. ★", "1.7. Si consideri...", "1.10. ★ Risolvere..."
 * Does NOT match: "### 1.1.B. Applicazioni" (letter suffix indicates section heading)
 *
 * Returns { number, rest } or null.
 */
function matchExerciseNumber(line: string): { number: string; rest: string } | null {
  const isHeading = /^#{1,4}\s+/.test(line);
  // Strip optional heading markers (##, ###, ####)
  const stripped = line.replace(/^#{1,4}\s+/, "");

  // Must start with digit.digit.
  const m = stripped.match(/^(\d+\.\d+)\.(.*)$/);
  if (!m) return null;

  const number = m[1];
  const rest = m[2]; // e.g. " ★", " Si consideri...", "B. Applicazioni"

  // If rest (after trimming) starts with an uppercase letter followed by ".",
  // it's a section heading sub-topic (1.1.B. ...) — skip it.
  // Exception: K alone is a star variant, not a section letter.
  if (/^\s*[A-JL-Z]\./.test(rest)) return null;

  // If this is a heading line and the rest is a plain section title
  // (capital letter + lowercase, e.g. "### 1.2. Equazioni lineari..."), skip it.
  if (isHeading && /^\s*[A-Z][a-z]/.test(rest)) return null;

  // Strip star markers from the beginning of rest before returning
  const restClean = rest.trimStart().replace(/^[★⊛*]|^\\&|^\bK\b/, "").trimStart();
  return { number, rest: restClean };
}

// ── Parse esempi ──────────────────────────────────────────────────────────────

/** Matches "Esempio 1.1." or "## Esempio 1.2." */
const ESEMPIO_RE = /^(?:#{1,4}\s+)?Esempio\s+(\d+\.\d+)\./;

function parseEsempi(lines: string[], start: number, end: number): Array<{ number: string; text: string }> {
  const blocks: Array<{ number: string; lines: string[] }> = [];
  let current: { number: string; lines: string[] } | null = null;

  for (let i = start; i < end; i++) {
    const line = lines[i];
    const m = line.match(ESEMPIO_RE);
    if (m) {
      if (current) blocks.push(current);
      current = { number: m[1], lines: [line] };
    } else if (/^#{1,4}\s+/.test(line) && !m) {
      // Any heading (section title) terminates current esempio
      if (current) blocks.push(current);
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  return blocks.map((b) => ({
    number: b.number,
    text: stripFootnotes(b.lines.join("\n").trim()),
  }));
}

/**
 * Split an esempio text into Q+A parts.
 *
 * Esempi structure: labels appear TWICE — first occurrence = question, second = solution.
 * Supports both "a. " style (Esempio 1.1, 1.2) and "(a) " style (Esempio 1.3, 1.4).
 * Text before the first label = shared preamble (the exercise description).
 */
function splitEsempioIntoParts(text: string): { preamble: string; parts: Part[] } {
  const lines = text.split("\n");
  // Strip the "Esempio X.X." header line from the preamble
  const contentLines = lines[0].match(ESEMPIO_RE) ? lines.slice(1) : lines;

  const preambleLines: string[] = [];
  const segments: Array<{ label: string; lines: string[] }> = [];
  let current: { label: string; lines: string[] } | null = null;
  let inMath = false;

  for (const line of contentLines) {
    if (line.trim() === "$$") inMath = !inMath;

    let label: string | null = null;
    if (!inMath) {
      // "a. " style: label alone at start of line
      const m1 = line.match(/^([a-e])\.\s/);
      // "(a) " style: label in parentheses — allow trailing space OR end-of-line
      const m2 = line.match(/^\(([a-e])\)(\s|$)/);
      if (m1) label = m1[1];
      else if (m2) label = m2[1];
    }

    if (label) {
      if (current) segments.push(current);
      current = { label, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  }
  if (current) segments.push(current);

  // First occurrence = question, second = solution
  const questions = new Map<string, string>();
  const solutions = new Map<string, string>();

  for (const seg of segments) {
    const segText = seg.lines.join("\n").trim();
    if (!questions.has(seg.label)) {
      questions.set(seg.label, segText);
    } else {
      solutions.set(seg.label, segText);
    }
  }

  const parts: Part[] = [...questions.keys()].map((lbl) => ({
    label: lbl,
    question_latex: questions.get(lbl)!,
    solution_latex: solutions.get(lbl) ?? null,
  }));

  return { preamble: preambleLines.join("\n").trim(), parts };
}

// ── Parse numbered exercises or applications ───────────────────────────────────

interface RawExercise {
  number: string;
  has_star: boolean;
  text: string;          // content lines (NOT including the header line's number)
  category: string | null;
}

function parseExerciseBlock(
  lines: string[],
  start: number,
  end: number,
  trackCategories: boolean
): RawExercise[] {
  const items: Array<{ number: string; has_star: boolean; lines: string[]; category: string | null }> = [];
  let current: { number: string; has_star: boolean; lines: string[]; category: string | null } | null = null;
  let currentCategory: string | null = null;

  for (let i = start; i < end; i++) {
    const line = lines[i];

    const isHeading = /^#{1,4}\s+/.test(line);
    const exMatch = matchExerciseNumber(line);

    if (isHeading && !exMatch) {
      // Any heading that isn't an exercise number terminates the current exercise
      // and starts a "dead zone" (intro text, section title, etc.) — just ignore.
      if (current) items.push(current);
      current = null;

      // In applications block, track sub-category headings (## Modelli di crescita)
      if (trackCategories && /^##\s+/.test(line)) {
        currentCategory = line.replace(/^##\s+/, "").trim();
      }
      continue;
    }

    if (exMatch) {
      if (current) items.push(current);
      // The rest of the header line (after number) may include text — include it
      current = {
        number: exMatch.number,
        has_star: detectStar(line),
        category: trackCategories ? currentCategory : null,
        lines: exMatch.rest ? [exMatch.rest] : [],
      };
    } else if (current) {
      current.lines.push(line);
    }
    // else: non-heading, non-exercise line while current=null → intro text, skip
  }
  if (current) items.push(current);

  return items.map((item) => ({
    number: item.number,
    has_star: item.has_star,
    category: item.category,
    text: stripFootnotes(item.lines.join("\n").trim()),
  }));
}

// ── Parse solutions section ────────────────────────────────────────────────────

/**
 * Parse the "Soluzioni" section into a map from exercise number → solution text.
 *
 * Solution lines look like:
 *   "1.1. a. Equazione a variabili separabili..."
 *   "1.4. a."
 *   "1.5. a. Equazione..."
 */
function parseSolutions(lines: string[], start: number, end: number): Map<string, string> {
  const map = new Map<string, string>();
  let currentNumber: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentNumber !== null) {
      map.set(currentNumber, stripFootnotes(currentLines.join("\n").trim()));
    }
  };

  for (let i = start; i < end; i++) {
    const line = lines[i];
    // Solution entries start with "1.X. " — same pattern as exercises
    // but we don't need the fancy logic (no section headings here)
    // Allow "1.20." alone on a line (no trailing whitespace or content)
    const m = line.match(/^(\d+\.\d+)\.\s*(.*)/);
    if (m) {
      flush();
      currentNumber = m[1];
      currentLines = m[2] ? [m[2]] : [];
    } else if (currentNumber !== null) {
      currentLines.push(line);
    }
  }
  flush();

  return map;
}

// ── Pair exercises with solutions and build final items ────────────────────────

function buildItems(
  rawItems: RawExercise[],
  solutions: Map<string, string>,
  exercise_type: "exercise" | "esempio" | "application",
  subtopic_id: string | null
): ParsedItem[] {
  return rawItems.map((raw) => {
    const solText = solutions.get(raw.number) ?? null;

    const { preamble: qPreamble, parts: qParts } = splitIntoParts(raw.text);
    const { preamble: sPreamble, parts: sParts } = solText
      ? splitIntoParts(solText)
      : { preamble: null as string | null, parts: [] as Array<{ label: string; text: string }> };

    const solByLabel = new Map(sParts.map((p) => [p.label, p.text]));

    // If the solution has a preamble (content before the first part label)
    // AND the question has parts, the preamble is the answer for part "a".
    if (sPreamble && qParts.length > 0 && !solByLabel.has("a")) {
      solByLabel.set("a", sPreamble);
    }

    if (qParts.length === 0) {
      // Single-part exercise
      return {
        number: raw.number,
        exercise_type,
        has_star: raw.has_star,
        question_latex: raw.text || qPreamble,
        // Non-starred: brief solution goes into solution_latex for display
        // Starred: full solution is in solText (AI will generate steps)
        solution_latex: solText,
        parts: [],
        subtopic_id,
        application_category: raw.category,
      };
    }

    // Multi-part exercise
    const parts: Part[] = qParts.map((qp) => ({
      label: qp.label,
      question_latex: qp.text,
      solution_latex: solByLabel.get(qp.label) ?? null,
    }));

    return {
      number: raw.number,
      exercise_type,
      has_star: raw.has_star,
      question_latex: qPreamble,   // shared preamble (may be empty)
      solution_latex: null,
      parts,
      subtopic_id,
      application_category: raw.category,
    };
  });
}

/** Esempi: split into Q+A parts using the repeating-label pattern. */
function buildEsempiItems(
  rawEsempi: Array<{ number: string; text: string }>,
  subtopic_id: string | null
): ParsedItem[] {
  return rawEsempi.map((e) => {
    const { preamble, parts } = splitEsempioIntoParts(e.text);
    return {
      number: e.number,
      exercise_type: "esempio" as const,
      has_star: false,
      question_latex: preamble,
      solution_latex: null,
      parts,
      subtopic_id,
      application_category: null,
    };
  });
}

// ── HTML preview (server-side KaTeX rendering — no browser JS needed) ─────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Render a LaTeX+Markdown text block to HTML using KaTeX server-side. */
function renderMath(text: string | null): string {
  if (!text) return '<span style="color:#333;font-style:italic">—</span>';

  // Replace ![alt](url) images with placeholders
  const imgs: Array<{ alt: string; src: string }> = [];
  let t = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    imgs.push({ alt, src });
    return `\x00IMG${imgs.length - 1}\x00`;
  });

  // Split on display math $$ ... $$
  const parts = t.split(/((?:\$\$)[\s\S]*?(?:\$\$))/g);
  let html = parts.map((part) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      const latex = part.slice(2, -2).trim();
      try {
        return katex.renderToString(latex, { displayMode: true, throwOnError: false });
      } catch {
        return `<code style="color:#f87171">${escHtml(part)}</code>`;
      }
    }
    // Split on inline math $ ... $
    const inlineParts = part.split(/(\$[^$\n]+?\$)/g);
    return inlineParts.map((ip) => {
      if (ip.startsWith("$") && ip.endsWith("$") && ip.length > 2) {
        try {
          return katex.renderToString(ip.slice(1, -1), { displayMode: false, throwOnError: false });
        } catch {
          return `<code style="color:#f87171">${escHtml(ip)}</code>`;
        }
      }
      return escHtml(ip).replace(/\n/g, "<br>");
    }).join("");
  }).join("");

  // Restore images
  imgs.forEach((img, i) => {
    html = html.replace(`\x00IMG${i}\x00`, `<img src="${img.src}" alt="${escHtml(img.alt)}" style="max-width:100%;border-radius:6px;margin:8px 0">`);
  });

  return html;
}

function generateHtml(items: ParsedItem[], filename: string): string {
  const total = items.length;
  const ne = items.filter((x) => x.exercise_type === "esempio").length;
  const nx = items.filter((x) => x.exercise_type === "exercise").length;
  const na = items.filter((x) => x.exercise_type === "application").length;
  const multi = items.filter((x) => x.parts.length > 0).length;
  const starred = items.filter((x) => x.has_star).length;

  // Get KaTeX CSS inline so no CDN is needed
  const katexCssPath = path.resolve(process.cwd(), "node_modules/katex/dist/katex.min.css");
  const katexCss = fs.existsSync(katexCssPath) ? fs.readFileSync(katexCssPath, "utf-8") : "";

  const typeLabel: Record<string, string> = { exercise: "Esercizio", esempio: "Esempio", application: "Applicazione" };
  const typeBadge: Record<string, string> = { exercise: "background:#0f2e1a;color:#4ade80", esempio: "background:#0f1e3a;color:#60a5fa", application: "background:#2e1e0a;color:#f59e0b" };

  function hasSolution(item: ParsedItem): boolean {
    if (item.parts.length > 0) return item.parts.some((p) => p.solution_latex !== null);
    return item.solution_latex !== null;
  }

  function renderPart(p: Part, idx: number): string {
    return `<div style="border-top:1px solid #1a1a1a">
      <div style="padding:4px 16px;font-size:10px;font-weight:700;letter-spacing:.12em;color:#555;background:#161616;text-transform:uppercase">Parte ${p.label.toUpperCase()}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr">
        <div style="padding:14px 16px;border-right:1px solid #1a1a1a;font-size:14px;line-height:1.7">
          <div style="font-size:9px;font-weight:700;letter-spacing:.12em;color:#444;margin-bottom:10px;text-transform:uppercase">Domanda</div>
          ${renderMath(p.question_latex)}
        </div>
        <div style="padding:14px 16px;font-size:14px;line-height:1.7">
          <div style="font-size:9px;font-weight:700;letter-spacing:.12em;color:#444;margin-bottom:10px;text-transform:uppercase">Soluzione</div>
          ${renderMath(p.solution_latex)}
        </div>
      </div>
    </div>`;
  }

  function renderItem(item: ParsedItem, i: number): string {
    const solOk = hasSolution(item);
    const headerRight = solOk
      ? `<span style="font-size:11px;color:#4ade80;margin-left:auto">✓ soluzione</span>`
      : `<span style="font-size:11px;color:#f87171;margin-left:auto">⚠ nessuna soluzione</span>`;

    let body = "";
    if (item.parts.length > 0) {
      if (item.question_latex) {
        body += `<div style="padding:14px 16px;background:#161616;border-bottom:1px solid #1a1a1a;font-size:14px;line-height:1.7">${renderMath(item.question_latex)}</div>`;
      }
      body += item.parts.map(renderPart).join("");
    } else {
      body = `<div style="display:grid;grid-template-columns:1fr 1fr">
        <div style="padding:14px 16px;border-right:1px solid #1a1a1a;font-size:14px;line-height:1.7">
          <div style="font-size:9px;font-weight:700;letter-spacing:.12em;color:#444;margin-bottom:10px;text-transform:uppercase">Domanda</div>
          ${renderMath(item.question_latex)}
        </div>
        <div style="padding:14px 16px;font-size:14px;line-height:1.7">
          <div style="font-size:9px;font-weight:700;letter-spacing:.12em;color:#444;margin-bottom:10px;text-transform:uppercase">Soluzione</div>
          ${renderMath(item.solution_latex)}
        </div>
      </div>`;
    }

    return `<div style="border:1px solid #222;border-radius:12px;margin-bottom:16px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#111;border-bottom:1px solid #222;flex-wrap:wrap">
        <span style="font-size:11px;background:#2a2a2a;border-radius:5px;padding:2px 8px;color:#888">#${i + 1}</span>
        <span style="font-weight:600;font-size:14px">Es. ${escHtml(item.number)}</span>
        <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px;${typeBadge[item.exercise_type]}">${typeLabel[item.exercise_type]}</span>
        ${item.has_star ? `<span style="color:#fbbf24">★</span>` : ""}
        ${item.parts.length > 0 ? `<span style="font-size:11px;color:#a78bfa">${item.parts.length} parti</span>` : ""}
        ${item.application_category ? `<span style="font-size:11px;color:#888;font-style:italic">${escHtml(item.application_category)}</span>` : ""}
        ${headerRight}
      </div>
      ${body}
    </div>`;
  }

  const rows = items.map(renderItem).join("\n");

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Preview — ${escHtml(filename)}</title>
<style>
${katexCss}
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; margin: 0; }
h1 { font-size: 20px; margin: 0 0 4px; }
.meta { color: #888; font-size: 13px; margin-bottom: 24px; line-height: 1.8; }
.katex-display { margin: 0.8em 0; overflow-x: auto; }
.katex { font-size: 1em; }
</style>
</head>
<body>
<h1>Preview — ${escHtml(filename)}</h1>
<p class="meta">
  <strong>${total}</strong> elementi totali &nbsp;·&nbsp;
  <span style="color:#60a5fa">${ne} esempi</span> &nbsp;·&nbsp;
  <span style="color:#4ade80">${nx} esercizi</span> &nbsp;·&nbsp;
  <span style="color:#f59e0b">${na} applicazioni</span><br>
  <span style="color:#a78bfa">${multi} multi-parte</span> &nbsp;·&nbsp;
  <span style="color:#fbbf24">${starred} con stella ★</span>
</p>
${rows}
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const { file, subject, source, chapter, subtopic, book, author } = parseArgs();

  if (!file) {
    console.error(
      "Usage: npx ts-node scripts/parse-markdown.ts <file.md>\n" +
      "  [--subject analisi2] [--source eserciziario]\n" +
      "  [--chapter \"Cap. 1. Equazioni differenziali\"]\n" +
      "  [--subtopic \"1.1.A\"]"
    );
    process.exit(1);
  }

  const inputPath = path.resolve(file);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, "utf-8");
  const lines = content.split("\n");

  console.log(`\nParsing ${path.basename(file)} (${lines.length} lines)…`);

  const blocks = identifyBlocks(lines);
  console.log(`\n  Block boundaries:`);
  console.log(`    Esempi+Exercises: lines 0–${blocks.applicationsStart} (multi-section scan)`);
  console.log(`    Applications:     lines ${blocks.applicationsStart}–${blocks.soluzioniStart}`);
  console.log(`    Solutions:        lines ${blocks.soluzioniStart}–${lines.length}`);

  if (blocks.exercisesStart === -1) console.warn("  ⚠ No '## Esercizi' found — scanning full file for exercises");

  // Scan the full pre-applications range for both esempi and exercises.
  // This handles files with multiple ## Esempi svolti / ## Esercizi sections,
  // and sections where exercises appear without an ## Esercizi header (e.g. 1.2.D).
  const rawEsempi = parseEsempi(lines, 0, blocks.applicationsStart);

  const rawExercises = parseExerciseBlock(
    lines, 0, blocks.applicationsStart, false
  );
  const rawApplications = parseExerciseBlock(
    lines, blocks.applicationsStart, blocks.soluzioniStart, true
  );
  const solutions = parseSolutions(lines, blocks.soluzioniStart, lines.length);

  console.log(`\n  Raw counts:`);
  console.log(`    ${rawEsempi.length} esempi`);
  console.log(`    ${rawExercises.length} exercises`);
  console.log(`    ${rawApplications.length} applications`);
  console.log(`    ${solutions.size} solutions`);

  const esempiItems = buildEsempiItems(rawEsempi, subtopic);
  const exerciseItems = buildItems(rawExercises, solutions, "exercise", subtopic);
  const applicationItems = buildItems(rawApplications, solutions, "application", blocks.applicationsSubtopic ?? subtopic);

  const allItems = [...esempiItems, ...exerciseItems, ...applicationItems];

  const multiPart = allItems.filter((x) => x.parts.length > 0).length;
  const withSolution = allItems.filter(
    (x) => x.solution_latex !== null || x.parts.some((p) => p.solution_latex !== null)
  ).length;
  const starred = allItems.filter((x) => x.has_star).length;

  console.log(`\n  Final:`);
  console.log(`    ${allItems.length} total items`);
  console.log(`    ${multiPart} multi-part exercises`);
  console.log(`    ${withSolution} with at least one solution`);
  console.log(`    ${starred} starred`);

  // Warn about exercises with no solution match
  const noSol = exerciseItems.filter(
    (x) => x.solution_latex === null && x.parts.every((p) => p.solution_latex === null)
  );
  if (noSol.length > 0) {
    console.warn(`\n  ⚠ ${noSol.length} exercises have no solution: ${noSol.map((x) => x.number).join(", ")}`);
  }

  const basename = path.basename(file, path.extname(file));
  const outputDir = path.resolve(process.cwd(), "scripts/output");
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonOutput = {
    meta: {
      subject,
      source,
      book: book ?? null,
      author: author ?? null,
      chapter: chapter ?? null,
      subtopic: subtopic ?? null,
      sourceFile: file,
      parsedAt: new Date().toISOString(),
    },
    items: allItems,
  };

  const jsonPath = path.join(outputDir, `${basename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), "utf-8");

  const htmlPath = path.join(outputDir, `${basename}.html`);
  fs.writeFileSync(htmlPath, generateHtml(allItems, basename), "utf-8");

  console.log(`\n  JSON → ${jsonPath}`);
  console.log(`  HTML → ${htmlPath}`);
  console.log(`\nReview the HTML preview, then upload with:`);
  console.log(`  npx ts-node scripts/upload-exercises.ts ${jsonPath}`);
}

main();
