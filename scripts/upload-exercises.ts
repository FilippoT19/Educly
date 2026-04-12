/**
 * upload-exercises.ts
 *
 * Reads the JSON produced by parse-markdown.ts and uploads items to Supabase.
 * Skips items already present (matched by exercise_number + source_document_id).
 *
 * Usage:
 *   npx ts-node scripts/upload-exercises.ts <file.json> [--source-document-id <uuid>]
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { ParsedItem, Part } from "./parse-markdown";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Topic IDs per subject — must match what's in the DB
const TOPIC_IDS: Record<string, string[]> = {
  analisi1: ["insiemi_numeri", "successioni", "limiti", "continuita", "derivate", "taylor", "studio_funzione", "integrali_indefiniti", "integrali_definiti", "serie"],
  analisi2: ["funzioni_piu_variabili", "derivate_parziali", "ottimizzazione", "integrali_doppi", "integrali_tripli", "curve_integrali_curvilinei", "campi_vettoriali", "superfici", "edo", "serie_funzioni"],
};

/**
 * difficulty mapping:
 *   0 = esempio (worked example)
 *   1 = easy (default for non-starred exercises)
 *   2 = medium (default for starred exercises — AI will refine)
 *   3 = hard
 */
function defaultDifficulty(item: ParsedItem): number {
  if (item.exercise_type === "esempio") return 0;
  if (item.has_star) return 2;
  return 1;
}

/**
 * Build the `answers` JSONB field.
 *
 * For multi-part exercises: one answer slot per part.
 * For single-part:
 *   - starred or no solution → open answer (AI will populate solution_steps)
 *   - non-starred with solution → open answer (solution_latex holds the expected output)
 * Esempi: no answer expected (it's a worked example to read).
 */
function buildAnswers(item: ParsedItem): Array<{ label: string; type: "open" | "exact" }> {
  if (item.exercise_type === "esempio") {
    return [];
  }
  if (item.parts.length > 0) {
    return item.parts.map((p) => ({ label: `Parte ${p.label.toUpperCase()}`, type: "open" as const }));
  }
  return [{ label: "Soluzione", type: "open" as const }];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const sdIdx = args.indexOf("--source-document-id");
  const sourceDocumentId = sdIdx !== -1 ? args[sdIdx + 1] : undefined;
  return { file, sourceDocumentId };
}

async function getOrCreateSourceDocument(meta: {
  subject: string;
  source: string;
  chapter: string | null;
  sourceFile: string;
  sourceDocumentId?: string;
}): Promise<string> {
  if (meta.sourceDocumentId) {
    console.log(`  Using existing source_document: ${meta.sourceDocumentId}`);
    return meta.sourceDocumentId;
  }

  const title = meta.chapter ?? path.basename(meta.sourceFile, path.extname(meta.sourceFile));
  const { data, error } = await supabase
    .from("source_documents")
    .insert({
      title,
      subject: meta.subject,
      doc_type: meta.source,
      engineering: "tutti",
      section: "tutti",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create source_document:", error?.message);
    process.exit(1);
  }

  console.log(`  Created source_document: ${data.id} ("${title}")`);
  return data.id;
}

async function main() {
  const { file, sourceDocumentId } = parseArgs();

  if (!file) {
    console.error("Usage: npx ts-node scripts/upload-exercises.ts <file.json> [--source-document-id <uuid>]");
    process.exit(1);
  }

  const inputPath = path.resolve(file);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const json = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  const { meta, items } = json as {
    meta: {
      subject: string;
      source: string;
      chapter: string | null;
      subtopic: string | null;
      sourceFile: string;
    };
    items: ParsedItem[];
  };

  const subject = meta.subject;
  const topicIds = TOPIC_IDS[subject];
  if (!topicIds) {
    console.error(`Unknown subject: ${subject}`);
    process.exit(1);
  }

  const byType = {
    esempio: items.filter((x) => x.exercise_type === "esempio").length,
    exercise: items.filter((x) => x.exercise_type === "exercise").length,
    application: items.filter((x) => x.exercise_type === "application").length,
  };

  console.log(`\nUploading ${items.length} items (subject: ${subject})`);
  console.log(`  ${byType.esempio} esempi, ${byType.exercise} exercises, ${byType.application} applications`);

  const docId = await getOrCreateSourceDocument({ ...meta, sourceDocumentId });

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    // Deduplicate by exercise_number + source_document_id
    const { data: existing } = await supabase
      .from("exercises")
      .select("id")
      .eq("exercise_number", item.number)
      .eq("source_document_id", docId)
      .limit(1)
      .single();

    if (existing) {
      console.log(`  [skip] ${item.number} — already in DB`);
      skipped++;
      continue;
    }

    const row = {
      subject,
      topic_id: topicIds[0],              // default first topic — populate will refine
      difficulty: defaultDifficulty(item),
      source: meta.source,
      question_latex: item.question_latex,
      solution_latex: item.solution_latex,
      hints: [],
      tags: [],
      answers: buildAnswers(item),
      solution_steps: [],
      concept_tags: [],
      engineering: "tutti",
      section: "tutti",
      source_document_id: docId,
      chapter_title: meta.chapter,
      // New fields from migration_v11
      parts: item.parts,
      has_star: item.has_star,
      exercise_type: item.exercise_type,
      subtopic_id: item.subtopic_id ?? meta.subtopic,
      application_category: item.application_category,
      exercise_number: item.number,
    };

    const { error } = await supabase.from("exercises").insert(row);
    if (error) {
      console.error(`  [error] ${item.number}: ${error.message}`);
      errors++;
    } else {
      const star = item.has_star ? " ★" : "";
      const parts = item.parts.length > 0 ? ` (${item.parts.length} parti)` : "";
      console.log(`  [ok] ${item.exercise_type} ${item.number}${star}${parts}`);
      uploaded++;
    }
  }

  console.log(`\n✓ Done: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`);

  if (uploaded > 0) {
    const needsPopulate = items.filter(
      (x) => x.has_star && x.exercise_type !== "esempio"
    ).length;
    if (needsPopulate > 0) {
      console.log(`\n${needsPopulate} starred exercises need AI populate (topic_id, difficulty, solution_steps, concept_tags).`);
      console.log(`Run "Popola 5" in the admin panel for this source document.`);
    }
  }
}

main();
