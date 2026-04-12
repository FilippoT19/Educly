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
  soluzioniStart: number;
}

function identifyBlocks(lines: string[]): BlockBounds {
  let esempiStart = -1;
  let esempiEnd = -1;
  let exercisesStart = -1;
  let applicationsStart = -1;
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
    // Section headings like "### 1.1.B. Applicazioni" — letter sub-topic after digit.digit
    if (/^#{2,3}\s+\d+\.\d+\.[A-Z]\./.test(line) && exercisesStart !== -1 && applicationsStart === -1) {
      applicationsStart = i + 1;
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

  return { esempiStart, esempiEnd, exercisesStart, applicationsStart, soluzioniStart };
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

  return { number, rest: rest.trimStart() };
}

// ── Parse esempi ──────────────────────────────────────────────────────────────

/** Matches "Esempio 1.1." or "## Esempio 1.2." */
const ESEMPIO_RE = /^(?:#{1,4}\s+)?Esempio\s+(\d+\.\d+)\./;

function parseEsempi(lines: string[], start: number, end: number): Array<{ number: string; text: string }> {
  const blocks: Array<{ number: string; lines: string[] }> = [];
  let current: { number: string; lines: string[] } | null = null;

  for (let i = start; i < end; i++) {
    const m = lines[i].match(ESEMPIO_RE);
    if (m) {
      if (current) blocks.push(current);
      current = { number: m[1], lines: [lines[i]] };
    } else if (current) {
      current.lines.push(lines[i]);
    }
  }
  if (current) blocks.push(current);

  return blocks.map((b) => ({
    number: b.number,
    text: stripFootnotes(b.lines.join("\n").trim()),
  }));
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

    // Sub-category headings inside the applications block (e.g. "## Modelli di crescita")
    // These are ## lines that are NOT exercise numbers
    if (trackCategories && /^##\s+/.test(line) && !matchExerciseNumber(line)) {
      currentCategory = line.replace(/^##\s+/, "").trim();
      continue;
    }

    const exMatch = matchExerciseNumber(line);
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

/** Esempi are stored as single-block items (no part splitting — Q+A interleaved). */
function buildEsempiItems(
  rawEsempi: Array<{ number: string; text: string }>,
  subtopic_id: string | null
): ParsedItem[] {
  return rawEsempi.map((e) => ({
    number: e.number,
    exercise_type: "esempio" as const,
    has_star: false,
    question_latex: e.text,
    solution_latex: null,
    parts: [],
    subtopic_id,
    application_category: null,
  }));
}

// ── HTML preview ──────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateHtml(items: ParsedItem[], filename: string): string {
  const typeColor: Record<string, string> = {
    exercise: "#4ade80",
    esempio: "#60a5fa",
    application: "#f59e0b",
  };

  const rows = items
    .map((item, i) => {
      let body: string;

      if (item.parts.length > 0) {
        const preamble = item.question_latex
          ? `<div class="preamble"><pre>${escHtml(item.question_latex)}</pre></div>`
          : "";
        const partRows = item.parts
          .map(
            (p) => `
          <div class="part">
            <div class="part-label">Parte ${p.label.toUpperCase()}</div>
            <div class="cols">
              <div class="col"><div class="label">DOMANDA</div><pre>${escHtml(p.question_latex)}</pre></div>
              <div class="col"><div class="label">SOLUZIONE</div><pre>${p.solution_latex ? escHtml(p.solution_latex) : "—"}</pre></div>
            </div>
          </div>`
          )
          .join("");
        body = preamble + partRows;
      } else {
        body = `
        <div class="cols">
          <div class="col"><div class="label">DOMANDA</div><pre>${escHtml(item.question_latex)}</pre></div>
          <div class="col"><div class="label">SOLUZIONE</div><pre>${item.solution_latex ? escHtml(item.solution_latex) : "—"}</pre></div>
        </div>`;
      }

      return `
    <div class="exercise">
      <div class="header">
        <span class="num">#${i + 1}</span>
        <span class="id">Es. ${item.number}</span>
        <span class="type" style="color:${typeColor[item.exercise_type]}">${item.exercise_type}${item.has_star ? " ★" : ""}</span>
        ${item.application_category ? `<span class="cat">${escHtml(item.application_category)}</span>` : ""}
        ${item.parts.length > 0 ? `<span class="parts-badge">${item.parts.length} parti</span>` : ""}
        ${item.parts.length === 0 && item.solution_latex ? '<span class="has-sol">✓ sol</span>' : ""}
        ${item.parts.length === 0 && !item.solution_latex ? '<span class="no-sol">⚠ no sol</span>' : ""}
      </div>
      ${body}
    </div>`;
    })
    .join("\n");

  const total = items.length;
  const ne = items.filter((x) => x.exercise_type === "esempio").length;
  const nx = items.filter((x) => x.exercise_type === "exercise").length;
  const na = items.filter((x) => x.exercise_type === "application").length;
  const multi = items.filter((x) => x.parts.length > 0).length;
  const starred = items.filter((x) => x.has_star).length;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Preview — ${escHtml(filename)}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; margin: 0; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; line-height: 1.6; }
  .exercise { border: 1px solid #222; border-radius: 12px; margin-bottom: 16px; overflow: hidden; }
  .header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #111; border-bottom: 1px solid #222; flex-wrap: wrap; }
  .num { font-size: 12px; background: #333; border-radius: 6px; padding: 2px 8px; }
  .id { font-weight: 600; font-size: 14px; }
  .type { font-size: 12px; font-weight: 600; }
  .cat { font-size: 11px; color: #888; margin-left: auto; font-style: italic; }
  .parts-badge { font-size: 11px; color: #a78bfa; }
  .has-sol { font-size: 11px; color: #4ade80; margin-left: auto; }
  .no-sol { font-size: 11px; color: #f87171; margin-left: auto; }
  .preamble { padding: 10px 16px; background: #0d0d0d; border-bottom: 1px solid #1a1a1a; }
  .part { border-top: 1px solid #1a1a1a; }
  .part-label { padding: 5px 16px; font-size: 10px; font-weight: 700; color: #666; letter-spacing: .12em; background: #0d0d0d; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; }
  .col { padding: 14px 16px; }
  .col:first-child { border-right: 1px solid #1a1a1a; }
  .label { font-size: 10px; font-weight: 700; letter-spacing: .1em; color: #555; margin-bottom: 8px; }
  pre { font-family: 'Menlo','Monaco',monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; color: #ccc; margin: 0; line-height: 1.5; }
</style>
</head>
<body>
<h1>Preview — ${escHtml(filename)}</h1>
<p class="meta">
  ${total} elementi totali &nbsp;·&nbsp;
  <span style="color:#60a5fa">${ne} esempi</span> &nbsp;·&nbsp;
  <span style="color:#4ade80">${nx} esercizi</span> &nbsp;·&nbsp;
  <span style="color:#f59e0b">${na} applicazioni</span><br>
  ${multi} multi-parte &nbsp;·&nbsp; ${starred} con stella
</p>
${rows}
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const { file, subject, source, chapter, subtopic } = parseArgs();

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
  console.log(`    Esempi:       lines ${blocks.esempiStart}–${blocks.esempiEnd}`);
  console.log(`    Exercises:    lines ${blocks.exercisesStart}–${blocks.applicationsStart}`);
  console.log(`    Applications: lines ${blocks.applicationsStart}–${blocks.soluzioniStart}`);
  console.log(`    Solutions:    lines ${blocks.soluzioniStart}–${lines.length}`);

  if (blocks.esempiStart === -1) console.warn("  ⚠ No '## Esempi svolti' found");
  if (blocks.exercisesStart === -1) {
    console.error("  ✗ No '## Esercizi' found — cannot continue");
    process.exit(1);
  }

  const rawEsempi = blocks.esempiStart !== -1
    ? parseEsempi(lines, blocks.esempiStart, blocks.esempiEnd)
    : [];

  const rawExercises = parseExerciseBlock(
    lines, blocks.exercisesStart, blocks.applicationsStart, false
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
  const applicationItems = buildItems(rawApplications, solutions, "application", subtopic);

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
