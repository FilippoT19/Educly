/**
 * parse-markdown.ts
 *
 * Parses a Markdown file containing exercises and solutions,
 * splits them, pairs them up, and writes a JSON preview file.
 *
 * Usage:
 *   npx ts-node scripts/parse-markdown.ts <file.md> [--subject analisi1|analisi2] [--source eserciziario|tema_passato|dispensa] [--chapter "Capitolo 3"]
 *
 * Output:
 *   scripts/output/<filename>.json  — the parsed exercises ready for upload
 *   scripts/output/<filename>.html  — visual preview in the browser
 *
 * RULES (edit the RULES section below to match your Markdown structure):
 *   - Exercises start with a line matching EXERCISE_START_RE
 *   - Solutions start with a line matching SOLUTION_START_RE
 *   - Each exercise is paired with the solution that has the same number
 */

import * as fs from "fs";
import * as path from "path";

// ── RULES — edit these to match your Markdown structure ──────────────────────

/**
 * Matches the start of an exercise block.
 * Capture group 1 must be the exercise number (e.g. "1", "2.3").
 *
 * Examples that match:
 *   ## Esercizio 1
 *   **Esercizio 1.**
 *   ### Es. 2.3
 *   Esercizio 1.
 */
const EXERCISE_START_RE = /^(?:#{1,4}\s+)?(?:Esercizio|Es\.?)\s+(\d+(?:\.\d+)?)[.\s]/im;

/**
 * Matches the start of a solution block.
 * Capture group 1 must be the exercise number it refers to.
 *
 * Examples that match:
 *   ## Soluzione 1
 *   **Soluzione 1.**
 *   Soluzione 1.
 *   Sol. 1
 */
const SOLUTION_START_RE = /^(?:#{1,4}\s+)?(?:Soluzione|Sol\.?)\s+(\d+(?:\.\d+)?)[.\s]/im;

// ─────────────────────────────────────────────────────────────────────────────

interface ParsedExercise {
  number: string;
  question: string;
  solution: string | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const subject = args[args.indexOf("--subject") + 1] ?? "analisi1";
  const source = args[args.indexOf("--source") + 1] ?? "eserciziario";
  const chapterRaw = args.indexOf("--chapter");
  const chapter = chapterRaw !== -1 ? args[chapterRaw + 1] : null;
  return { file, subject, source, chapter };
}

function splitByPattern(
  content: string,
  pattern: RegExp
): Array<{ number: string; text: string }> {
  const lines = content.split("\n");
  const blocks: Array<{ number: string; text: string }> = [];
  let current: { number: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      if (current) blocks.push({ number: current.number, text: current.lines.join("\n").trim() });
      current = { number: match[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push({ number: current.number, text: current.lines.join("\n").trim() });

  return blocks;
}

function parseMarkdown(content: string): ParsedExercise[] {
  const exercises = splitByPattern(content, EXERCISE_START_RE);
  const solutions = splitByPattern(content, SOLUTION_START_RE);

  const solutionMap = new Map(solutions.map((s) => [s.number, s.text]));

  return exercises.map((ex) => ({
    number: ex.number,
    question: ex.text,
    solution: solutionMap.get(ex.number) ?? null,
  }));
}

function generateHtml(exercises: ParsedExercise[], filename: string): string {
  const rows = exercises
    .map(
      (ex, i) => `
    <div class="exercise">
      <div class="header">
        <span class="num">#${i + 1}</span>
        <span class="id">Esercizio ${ex.number}</span>
        ${ex.solution ? '<span class="has-sol">✓ Soluzione trovata</span>' : '<span class="no-sol">⚠ Nessuna soluzione</span>'}
      </div>
      <div class="cols">
        <div class="col">
          <div class="label">DOMANDA</div>
          <pre>${escHtml(ex.question)}</pre>
        </div>
        <div class="col">
          <div class="label">SOLUZIONE</div>
          <pre>${ex.solution ? escHtml(ex.solution) : "—"}</pre>
        </div>
      </div>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Preview — ${escHtml(filename)}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; margin: 0; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
  .exercise { border: 1px solid #222; border-radius: 12px; margin-bottom: 16px; overflow: hidden; }
  .header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #111; border-bottom: 1px solid #222; }
  .num { font-size: 12px; background: #333; border-radius: 6px; padding: 2px 8px; }
  .id { font-weight: 600; font-size: 14px; }
  .has-sol { margin-left: auto; font-size: 12px; color: #4ade80; }
  .no-sol { margin-left: auto; font-size: 12px; color: #f87171; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .col { padding: 14px 16px; }
  .col:first-child { border-right: 1px solid #222; }
  .label { font-size: 10px; font-weight: 700; letter-spacing: .1em; color: #666; margin-bottom: 8px; }
  pre { font-family: 'Menlo', 'Monaco', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; color: #ccc; margin: 0; line-height: 1.5; }
</style>
</head>
<body>
<h1>Preview — ${escHtml(filename)}</h1>
<p class="meta">${exercises.length} esercizi trovati · verifica che ogni soluzione combaci con la domanda prima di caricare</p>
${rows}
</body>
</html>`;
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function main() {
  const { file, subject, source, chapter } = parseArgs();

  if (!file) {
    console.error("Usage: npx ts-node scripts/parse-markdown.ts <file.md> [--subject analisi1|analisi2] [--source eserciziario|tema_passato|dispensa] [--chapter \"Capitolo 3\"]");
    process.exit(1);
  }

  const inputPath = path.resolve(file);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, "utf-8");
  const exercises = parseMarkdown(content);

  if (exercises.length === 0) {
    console.error("⚠ No exercises found. Check that EXERCISE_START_RE matches your file.");
    console.error("First 10 lines of file:");
    console.error(content.split("\n").slice(0, 10).join("\n"));
    process.exit(1);
  }

  const basename = path.basename(file, path.extname(file));
  const outputDir = path.join(path.dirname(inputPath), "..", "scripts", "output");
  fs.mkdirSync(outputDir, { recursive: true });

  // JSON output (for upload script)
  const jsonOutput = {
    meta: { subject, source, chapter, sourceFile: file, parsedAt: new Date().toISOString() },
    exercises: exercises.map((ex) => ({
      number: ex.number,
      question_latex: ex.question,
      solution_latex: ex.solution,
    })),
  };
  const jsonPath = path.join(outputDir, `${basename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), "utf-8");

  // HTML preview
  const htmlPath = path.join(outputDir, `${basename}.html`);
  fs.writeFileSync(htmlPath, generateHtml(exercises, basename), "utf-8");

  console.log(`\n✓ Parsed ${exercises.length} exercises`);
  console.log(`  ${exercises.filter((e) => e.solution).length} with solutions, ${exercises.filter((e) => !e.solution).length} without`);
  console.log(`\n  JSON → ${jsonPath}`);
  console.log(`  HTML → ${htmlPath}`);
  console.log(`\nOpen the HTML file in your browser to review, then run:`);
  console.log(`  npx ts-node scripts/upload-exercises.ts ${jsonPath}`);
}

main();
