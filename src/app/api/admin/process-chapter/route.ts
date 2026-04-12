export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { extractExercisesFromPdf, extractTheoryFromPdf } from "@/lib/ingestion";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    storagePath,
    sourceDocumentId,
    chapterTitle,
    chapterIndex,
    totalChapters,
  } = body;

  if (!storagePath || !sourceDocumentId || !chapterTitle) {
    return NextResponse.json({ error: "Missing fields: storagePath, sourceDocumentId, chapterTitle" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch book metadata from DB — no need to send it from the client
  const { data: doc, error: docError } = await supabase
    .from("source_documents")
    .select("title, subject, doc_type, engineering, section")
    .eq("id", sourceDocumentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const { title: bookTitle, subject, doc_type: docType, engineering, section } = doc;

  // Download PDF from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("tmp-pdfs")
    .download(storagePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: `Storage download failed: ${downloadError?.message}` }, { status: 500 });
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Clean up from storage immediately
  supabase.storage.from("tmp-pdfs").remove([storagePath]).catch(() => {});

  try {
    if (docType === "libro_teoria") {
      // Auto-compute lessonOrderStart from existing lessons for this book
      const { data: maxRow } = await supabase
        .from("theory_lessons")
        .select("lesson_order")
        .eq("source_document_id", sourceDocumentId)
        .order("lesson_order", { ascending: false })
        .limit(1)
        .single();
      const lessonOrderStart = (maxRow?.lesson_order ?? 0) + 1;

      const lessons = await extractTheoryFromPdf(base64, subject, {
        bookTitle, chapterTitle, chapterIndex, totalChapters,
      });

      if (lessons.length > 0) {
        await supabase.from("theory_lessons").insert(
          lessons.map((l, idx) => ({
            subject,
            topic_id: l.topic_id,
            lesson_order: lessonOrderStart + idx,
            title: l.title,
            content_markdown: l.content_markdown,
            key_concepts: l.key_concepts,
            mini_quiz: l.mini_quiz,
            engineering,
            section,
            source_document_id: sourceDocumentId,
          }))
        );
      }

      return NextResponse.json({ extracted: lessons.length });
    } else {
      const exercises = await extractExercisesFromPdf(base64, subject, docType, {
        bookTitle, chapterTitle, chapterIndex, totalChapters,
      });

      if (exercises.length > 0) {
        await supabase.from("exercises").insert(
          exercises.map((e) => ({
            subject,
            topic_id: e.topic_id,
            difficulty: e.difficulty,
            source: docType,
            question_latex: e.question_latex,
            solution_latex: e.solution_latex,
            hints: e.hints,
            tags: e.tags,
            engineering,
            section,
            source_document_id: sourceDocumentId,
          }))
        );
      }

      return NextResponse.json({ extracted: exercises.length });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ extracted: 0, error: msg });
  }
}
