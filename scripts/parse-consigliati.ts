/**
 * parse-consigliati.ts
 *
 * Parses "esercizi consigliati" markdown files (professor-curated exercises).
 * Format is simpler than the Bramanti book:
 *   ## Section Title
 *   1.  Exercise text...
 *       1)  Sub-part a
 *       2)  Sub-part b
 *   2.  Exercise text...
 *   ## Soluzioni.
 *   1.  Solution text...
 *
 * Usage:
 *   npx ts-node scripts/parse-consigliati.ts <file.md> \
 *     --topic <topic_id> \
 *     [--subject analisi2] \
 *     [--source-title "Analisi2 esercizi consigliati"] \
 *     [--source "Esercizi consigliati"] \
 *     [--dry-run]
 *
 * --source-title creates (or reuses) a source_documents entry so exercises
 * appear in the admin library under that folder name.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    topicId: get("--topic"),
    subject: get("--subject") ?? "analisi2",
    source: get("--source") ?? "Esercizi consigliati",
    sourceTitle: get("--source-title"),   // folder name in admin library
    dryRun: args.includes("--dry-run"),
  };
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface ExerciseItem {
  number: string;
  question_latex: string;
  solution_latex: string | null;
  chapter_title: string;
}

function parseFile(content: string): ExerciseItem[] {
  const lines = content.split("\n");

  // Find section title (first ## heading that is NOT "Soluzioni")
  let chapterTitle = "Esercizi";
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (m && !/soluzioni/i.test(m[1])) {
      chapterTitle = m[1].trim();
      break;
    }
  }

  // Find solutions start
  let solutionsStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Soluzioni/.test(lines[i].trim())) {
      solutionsStart = i + 1;
      break;
    }
  }

  const exerciseEnd = solutionsStart !== -1 ? solutionsStart - 1 : lines.length;
  const exerciseLines = lines.slice(0, exerciseEnd);
  const solutionLines = solutionsStart !== -1 ? lines.slice(solutionsStart) : [];

  const exercises = extractNumberedBlocks(exerciseLines);
  const solutions = extractNumberedBlocks(solutionLines);

  // Merge
  return exercises.map((ex) => {
    const sol = solutions.find((s) => s.number === ex.number);
    return {
      number: ex.number,
      question_latex: ex.text,
      solution_latex: sol?.text ?? null,
      chapter_title: chapterTitle,
    };
  });
}

/**
 * Extract blocks numbered "N." at line start (where N is an integer).
 * Everything until the next "N." block is part of the current block.
 */
function extractNumberedBlocks(lines: string[]): Array<{ number: string; text: string }> {
  const blocks: Array<{ number: string; startLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\d+)\.\s/);
    if (m) {
      blocks.push({ number: m[1], startLine: i });
    }
  }

  return blocks.map((b, idx) => {
    const endLine = idx < blocks.length - 1 ? blocks[idx + 1].startLine : lines.length;
    const raw = lines.slice(b.startLine, endLine)
      .join("\n")
      .replace(/^\d+\.\s+/, "")
      .trim();
    return { number: b.number, text: raw };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { file, topicId, subject, source, sourceTitle, dryRun } = parseArgs();

  if (!file || !topicId) {
    console.error("Usage: npx ts-node scripts/parse-consigliati.ts <file.md> --topic <topic_id>");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const items = parseFile(content);

  console.log(`\nParsed ${items.length} exercises from ${path.basename(file)}`);
  console.log(`Subject: ${subject} / Topic: ${topicId} / Source: ${source}`);
  console.log(`Chapter: ${items[0]?.chapter_title ?? "—"}`);
  console.log(`Priority: 1 (professor-curated)\n`);

  items.forEach((item) => {
    const preview = item.question_latex.replace(/\n/g, " ").slice(0, 80);
    const hasSol = item.solution_latex ? "✓ sol" : "— no sol";
    console.log(`  ${item.number}. [${hasSol}] ${preview}…`);
  });

  if (dryRun) {
    console.log("\n[dry-run] Skipping upload.");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Resolve source_document_id ─────────────────────────────────────────────
  let sourceDocumentId: string | null = null;

  if (sourceTitle) {
    // Check if a source_documents row with this title already exists
    const { data: existing } = await supabase
      .from("source_documents")
      .select("id")
      .eq("title", sourceTitle)
      .eq("subject", subject)
      .limit(1)
      .single();

    if (existing) {
      sourceDocumentId = existing.id;
      console.log(`\nReusing existing source_document: ${sourceTitle} (${sourceDocumentId})`);
    } else {
      // Create it
      const { data: created, error: createErr } = await supabase
        .from("source_documents")
        .insert({
          title: sourceTitle,
          subject,
          doc_type: "eserciziario",
          engineering: "tutti",
          section: "tutti",
        })
        .select("id")
        .single();

      if (createErr || !created) {
        console.error("Failed to create source_document:", createErr?.message);
        process.exit(1);
      }
      sourceDocumentId = created.id;
      console.log(`\nCreated source_document: ${sourceTitle} (${sourceDocumentId})`);
    }
  }

  console.log(`\nUploading ${items.length} exercises…`);

  let uploaded = 0;
  let failed = 0;

  for (const item of items) {
    const filename = path.basename(file, ".md");
    const exerciseNumber = `${filename.replace(/\s+/g, "_")}_${item.number}`;

    const row: Record<string, unknown> = {
      subject,
      topic_id: topicId,
      source,
      exercise_number: exerciseNumber,
      question_latex: item.question_latex,
      solution_latex: item.solution_latex,
      has_star: !!item.solution_latex,
      difficulty: 2,
      hints: [],
      answers: [],
      solution_steps: [],
      concept_tags: [],
      priority: 1,
      chapter_title: item.chapter_title,
    };

    if (sourceDocumentId) {
      row.source_document_id = sourceDocumentId;
    }

    const { error } = await supabase.from("exercises").insert(row);

    if (error) {
      console.error(`  FAILED ${item.number}: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${item.number}`);
      uploaded++;
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${failed} failed.`);
}

main();
