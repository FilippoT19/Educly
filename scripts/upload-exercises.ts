/**
 * upload-exercises.ts
 *
 * Takes a JSON file produced by parse-markdown.ts and uploads
 * the exercises to Supabase. Skips exercises already present (by question text).
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

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

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

const OPEN_FALLBACK = {
  answers: [{ label: "Soluzione", type: "open" as const }],
  solution_steps: [],
  concept_tags: [],
};

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

  // Create a new source_document entry
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
  const { meta, exercises } = json as {
    meta: { subject: string; source: string; chapter: string | null; sourceFile: string };
    exercises: Array<{ number: string; question_latex: string; solution_latex: string | null }>;
  };

  const subject = meta.subject;
  const topicIds = TOPIC_IDS[subject];
  if (!topicIds) {
    console.error(`Unknown subject: ${subject}`);
    process.exit(1);
  }

  console.log(`\nUploading ${exercises.length} exercises (subject: ${subject}, source: ${meta.source})`);

  const docId = await getOrCreateSourceDocument({ ...meta, sourceDocumentId });

  let uploaded = 0;
  let skipped = 0;

  for (const ex of exercises) {
    // Check if already exists by question text to avoid duplicates
    const { data: existing } = await supabase
      .from("exercises")
      .select("id")
      .eq("question_latex", ex.question_latex)
      .eq("source_document_id", docId)
      .limit(1)
      .single();

    if (existing) {
      console.log(`  [skip] #${ex.number} — already in DB`);
      skipped++;
      continue;
    }

    const row = {
      subject,
      topic_id: topicIds[0], // default to first topic — can be updated via admin populate
      difficulty: 2,         // default medium — populate will refine this
      source: meta.source,
      question_latex: ex.question_latex,
      solution_latex: ex.solution_latex,
      hints: [],
      tags: [],
      answers: OPEN_FALLBACK.answers,
      solution_steps: OPEN_FALLBACK.solution_steps,
      concept_tags: OPEN_FALLBACK.concept_tags,
      engineering: "tutti",
      section: "tutti",
      source_document_id: docId,
      chapter_title: meta.chapter,
    };

    const { error } = await supabase.from("exercises").insert(row);
    if (error) {
      console.error(`  [error] #${ex.number}: ${error.message}`);
    } else {
      console.log(`  [ok] #${ex.number}`);
      uploaded++;
    }
  }

  console.log(`\n✓ Done: ${uploaded} uploaded, ${skipped} skipped`);
  if (uploaded > 0) {
    console.log(`\nNow go to the admin panel and use "Popola 5" to fill in`);
    console.log(`topic_id, difficulty, answers, solution_steps and concept_tags.`);
  }
}

main();
