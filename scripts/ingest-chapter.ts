#!/usr/bin/env node
/**
 * Ingest a single PDF chapter directly into Supabase — no Vercel, no UI.
 *
 * Usage:
 *   npx tsx scripts/ingest-chapter.ts \
 *     --file ./cap3.pdf \
 *     --book-id <uuid>          # get it from Supabase or after "Crea risorsa" nel UI
 *     --chapter "Capitolo 3 — Derivate"
 *     [--index 3]               # optional: chapter number
 *     [--total 12]              # optional: total chapters in book
 *     [--model sonnet]          # sonnet (default, fast+cheap) | opus (best quality)
 *
 * The book must already exist in source_documents (created via the Admin UI).
 * Run the script once per chapter (or per part if the chapter is split).
 *
 * Requires: .env.local with ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

// ── Args ──────────────────────────────────────────────────────────────────────
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const filePath     = arg("--file");
const bookId       = arg("--book-id");
const chapterTitle = arg("--chapter");
const chapterIndex = arg("--index")  ? parseInt(arg("--index")!)  : undefined;
const totalChapters= arg("--total")  ? parseInt(arg("--total")!)  : undefined;
const modelFlag    = arg("--model") ?? "sonnet";

if (!filePath || !bookId || !chapterTitle) {
  console.error("Usage: npx tsx scripts/ingest-chapter.ts --file <pdf> --book-id <uuid> --chapter \"Titolo\" [--index N] [--total N] [--model sonnet|opus]");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const MODEL = modelFlag === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Topic IDs ─────────────────────────────────────────────────────────────────
const TOPIC_IDS: Record<string, string[]> = {
  analisi1: ["insiemi_numeri", "successioni", "limiti", "continuita", "derivate", "taylor", "studio_funzione", "integrali_indefiniti", "integrali_definiti", "serie"],
  analisi2: ["funzioni_piu_variabili", "derivate_parziali", "ottimizzazione", "integrali_doppi", "integrali_tripli", "curve_integrali_curvilinei", "campi_vettoriali", "superfici", "edo", "serie_funzioni"],
};

function parseChapterPart(title: string) {
  const m = title.match(/parte\s*(\d+)(?:\s*(?:di|\/)\s*(\d+))?/i);
  if (!m) return { isPartial: false, partLabel: "" };
  const partLabel = m[2] ? `Parte ${m[1]} di ${m[2]}` : `Parte ${m[1]}`;
  return { isPartial: true, partLabel };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📖  Ingest chapter: "${chapterTitle}"`);
  console.log(`    Model:   ${MODEL}`);
  console.log(`    File:    ${filePath} (${(fs.statSync(filePath!).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`    Book ID: ${bookId}\n`);

  // Fetch book metadata
  const { data: book, error: bookErr } = await supabase
    .from("source_documents")
    .select("title, subject, doc_type, engineering, section")
    .eq("id", bookId)
    .single();

  if (bookErr || !book) {
    console.error("❌  Book not found:", bookErr?.message ?? "no data");
    process.exit(1);
  }

  console.log(`📚  Book: "${book.title}" [${book.subject} · ${book.doc_type}]\n`);

  const topicIds = TOPIC_IDS[book.subject] ?? TOPIC_IDS["analisi1"];
  const subjectName = book.subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";
  const { isPartial, partLabel } = parseChapterPart(chapterTitle!);

  let contextBlock = `
CONTESTO:
- Libro: "${book.title}"
- Capitolo${chapterIndex ? ` ${chapterIndex} di ${totalChapters}` : ""}: "${chapterTitle}"${
  isPartial ? `\n- Nota: questo PDF è solo la ${partLabel} del capitolo.` : ""
}`;

  // Read PDF
  const pdfBytes = fs.readFileSync(filePath!);
  const pdfBase64 = pdfBytes.toString("base64");

  // Build prompt
  let prompt: string;

  if (book.doc_type === "libro_teoria") {
    prompt = `Sei un esperto di ${subjectName} al Politecnico italiano. Il documento è un PDF che può essere scannerizzato e contenere testo, formule matematiche, teoremi e grafici. Trascrivi fedelmente tutto il materiale.
${contextBlock}

Analizza questo materiale e crea lezioni di teoria strutturate.

Per ogni sezione/argomento distinto crea UNA lezione con:
- topic_id: uno tra ${topicIds.join(", ")}
- lesson_order: numero progressivo a partire da 1 (all'interno di questo PDF)
- title: titolo chiaro e descrittivo
- content_markdown: contenuto completo in Markdown con formule LaTeX ($...$ inline, $$...$$ display). Includi definizioni, teoremi, dimostrazioni, esempi numerici.
- key_concepts: array di 3-6 concetti chiave
- mini_quiz: array di 3 domande a scelta multipla: { "question": "...", "options": ["A","B","C","D"], "correct_index": 0 }

Rispondi SOLO con un array JSON valido:
[{ "topic_id":"...", "lesson_order":1, "title":"...", "content_markdown":"...", "key_concepts":["..."], "mini_quiz":[{"question":"...","options":["...","...","...","..."],"correct_index":0}] }]`;
  } else {
    prompt = `Sei un esperto di ${subjectName} al Politecnico italiano. Il documento è un PDF che può essere scannerizzato e contenere testo, formule matematiche e grafici. Sii preciso nell'interpretare il contenuto visivo.
${contextBlock}

Estrai TUTTI gli esercizi presenti in questo documento. Non saltarne nessuno.

Per ogni esercizio:
- topic_id: uno tra ${topicIds.join(", ")}
- difficulty: 1 (facile), 2 (medio), 3 (difficile)
- question_latex: testo completo in LaTeX ($...$ inline, $$...$$ display). Trascrivi fedelmente tutte le formule.
- solution_latex: soluzione completa passo-passo in LaTeX. Se non è nel documento, costruiscila tu.
- hints: array di 2-3 suggerimenti strategici
- tags: array di sottotemi es. ["integrazione_per_parti", "cambio_variabile"]

Rispondi SOLO con un array JSON valido:
[{ "topic_id":"...", "difficulty":2, "question_latex":"...", "solution_latex":"...", "hints":["..."], "tags":["..."] }]`;
  }

  // Call Claude
  console.log(`🤖  Calling Claude (${MODEL})…`);
  const t0 = Date.now();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`✅  Claude responded in ${elapsed}s`);

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("❌  No JSON array in response. Raw output:\n", text.slice(0, 500));
    process.exit(1);
  }

  const items = JSON.parse(jsonMatch[0]);
  console.log(`📦  Extracted: ${items.length} ${book.doc_type === "libro_teoria" ? "lezioni" : "esercizi"}`);

  if (items.length === 0) {
    console.warn("⚠️   Nothing extracted. Check the PDF and try again.");
    process.exit(0);
  }

  // Insert into DB
  if (book.doc_type === "libro_teoria") {
    // Get current max lesson_order for this book
    const { data: maxRow } = await supabase
      .from("theory_lessons")
      .select("lesson_order")
      .eq("source_document_id", bookId)
      .order("lesson_order", { ascending: false })
      .limit(1)
      .single();
    const lessonOrderStart = (maxRow?.lesson_order ?? 0) + 1;

    const rows = items.map((l: Record<string, unknown>, idx: number) => ({
      subject: book.subject,
      topic_id: l.topic_id,
      lesson_order: lessonOrderStart + idx,
      title: l.title,
      content_markdown: l.content_markdown,
      key_concepts: l.key_concepts,
      mini_quiz: l.mini_quiz,
      engineering: book.engineering,
      section: book.section,
      source_document_id: bookId,
    }));

    const { error } = await supabase.from("theory_lessons").insert(rows);
    if (error) { console.error("❌  DB insert error:", error.message); process.exit(1); }
    console.log(`💾  Inserted ${rows.length} lezioni (lesson_order ${lessonOrderStart}–${lessonOrderStart + rows.length - 1})`);
  } else {
    const rows = items.map((e: Record<string, unknown>) => ({
      subject: book.subject,
      topic_id: e.topic_id,
      difficulty: e.difficulty,
      source: book.doc_type,
      question_latex: e.question_latex,
      solution_latex: e.solution_latex,
      hints: e.hints,
      tags: e.tags,
      engineering: book.engineering,
      section: book.section,
      source_document_id: bookId,
    }));

    const { error } = await supabase.from("exercises").insert(rows);
    if (error) { console.error("❌  DB insert error:", error.message); process.exit(1); }
    console.log(`💾  Inserted ${rows.length} esercizi`);
  }

  // Token usage
  const usage = response.usage;
  console.log(`\n💰  Token usage: ${usage.input_tokens.toLocaleString()} in + ${usage.output_tokens.toLocaleString()} out`);
  console.log(`\n✅  Done!\n`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
