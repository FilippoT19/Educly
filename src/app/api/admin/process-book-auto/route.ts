export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractExercisesFromPdf, extractTheoryFromPdf } from "@/lib/ingestion";
import { PDFDocument } from "pdf-lib";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bookTitle = formData.get("bookTitle") as string;
  const subject = formData.get("subject") as string;
  const docType = formData.get("docType") as string;
  const engineering = (formData.get("engineering") as string) || "tutti";
  const section = (formData.get("section") as string) || "tutti";
  const chaptersJson = formData.get("chapters") as string;

  if (!file || !bookTitle || !subject || !docType || !chaptersJson) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const chapters: { title: string; toc_page: number; pdf_page_index: number }[] = JSON.parse(chaptersJson);
  if (chapters.length === 0) {
    return NextResponse.json({ error: "No chapters provided" }, { status: 400 });
  }

  // Load full PDF
  const arrayBuffer = await file.arrayBuffer();
  const fullPdf = await PDFDocument.load(arrayBuffer);
  const totalPages = fullPdf.getPageCount();

  const supabase = await createClient();

  // Create parent source document
  const { data: doc, error: docError } = await supabase
    .from("source_documents")
    .insert({ subject, doc_type: docType, title: bookTitle, engineering, section })
    .select()
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Failed to create source document" }, { status: 500 });
  }

  const results: { chapter: string; extracted: number; error?: string }[] = [];
  let totalExtracted = 0;
  let globalLessonOrder = 1;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const startPage = chapter.pdf_page_index;
    const endPage = i < chapters.length - 1 ? chapters[i + 1].pdf_page_index - 1 : totalPages - 1;

    // Clamp page indices to valid range
    const clampedStart = Math.max(0, Math.min(startPage, totalPages - 1));
    const clampedEnd = Math.max(clampedStart, Math.min(endPage, totalPages - 1));

    try {
      // Extract chapter as a separate PDF
      const chapterPdf = await PDFDocument.create();
      const pageIndices = Array.from(
        { length: clampedEnd - clampedStart + 1 },
        (_, k) => clampedStart + k
      );
      const copiedPages = await chapterPdf.copyPages(fullPdf, pageIndices);
      copiedPages.forEach((p) => chapterPdf.addPage(p));
      const chapterBytes = await chapterPdf.save();
      const chapterBase64 = Buffer.from(chapterBytes).toString("base64");

      if (docType === "libro_teoria") {
        const lessons = await extractTheoryFromPdf(chapterBase64, subject, {
          bookTitle,
          chapterTitle: chapter.title,
          chapterIndex: i + 1,
          totalChapters: chapters.length,
        });

        if (lessons.length > 0) {
          const lessonsWithOrder = lessons.map((l, idx) => ({
            subject,
            topic_id: l.topic_id,
            lesson_order: globalLessonOrder + idx,
            title: l.title,
            content_markdown: l.content_markdown,
            key_concepts: l.key_concepts,
            mini_quiz: l.mini_quiz,
            engineering,
            section,
            source_document_id: doc.id,
          }));
          globalLessonOrder += lessons.length;
          await supabase.from("theory_lessons").insert(lessonsWithOrder);
        }

        results.push({ chapter: chapter.title, extracted: lessons.length });
        totalExtracted += lessons.length;
      } else {
        const exercises = await extractExercisesFromPdf(chapterBase64, subject, docType, {
          bookTitle,
          chapterTitle: chapter.title,
          chapterIndex: i + 1,
          totalChapters: chapters.length,
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
              source_document_id: doc.id,
            }))
          );
        }

        results.push({ chapter: chapter.title, extracted: exercises.length });
        totalExtracted += exercises.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({ chapter: chapter.title, extracted: 0, error: msg });
    }
  }

  // Update totals
  if (docType === "libro_teoria") {
    await supabase.from("source_documents").update({ lessons_extracted: totalExtracted }).eq("id", doc.id);
  } else {
    await supabase.from("source_documents").update({ exercises_extracted: totalExtracted }).eq("id", doc.id);
  }

  return NextResponse.json({ success: true, results, totalExtracted, documentId: doc.id });
}
