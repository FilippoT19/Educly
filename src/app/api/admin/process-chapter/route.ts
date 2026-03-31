import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractExercisesFromPdf, extractTheoryFromPdf } from "@/lib/ingestion";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bookTitle = formData.get("bookTitle") as string;
  const chapterTitle = formData.get("chapterTitle") as string;
  const subject = formData.get("subject") as string;
  const docType = formData.get("docType") as string;
  const engineering = (formData.get("engineering") as string) || "tutti";
  const section = (formData.get("section") as string) || "tutti";
  const chapterIndex = parseInt(formData.get("chapterIndex") as string);
  const totalChapters = parseInt(formData.get("totalChapters") as string);
  const lessonOrderStart = parseInt((formData.get("lessonOrderStart") as string) || "1");
  // sourceDocumentId is passed for chapters 2..N so they link to the same parent
  let sourceDocumentId = formData.get("sourceDocumentId") as string | null;

  if (!file || !bookTitle || !chapterTitle || !subject || !docType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const supabase = await createClient();

  // Create source document only on the first chapter
  if (!sourceDocumentId) {
    const { data: doc, error: docError } = await supabase
      .from("source_documents")
      .insert({ subject, doc_type: docType, title: bookTitle, engineering, section })
      .select()
      .single();
    if (docError || !doc) {
      return NextResponse.json({ error: "Failed to create source document" }, { status: 500 });
    }
    sourceDocumentId = doc.id;
  }

  try {
    if (docType === "libro_teoria") {
      const lessons = await extractTheoryFromPdf(base64, subject, {
        bookTitle,
        chapterTitle,
        chapterIndex,
        totalChapters,
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

      return NextResponse.json({ sourceDocumentId, extracted: lessons.length });
    } else {
      const exercises = await extractExercisesFromPdf(base64, subject, docType, {
        bookTitle,
        chapterTitle,
        chapterIndex,
        totalChapters,
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

      return NextResponse.json({ sourceDocumentId, extracted: exercises.length });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ sourceDocumentId, extracted: 0, error: msg });
  }
}
