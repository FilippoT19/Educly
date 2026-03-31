import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractExercisesFromPdf, extractTheoryFromPdf } from "@/lib/ingestion";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const bookTitle = formData.get("bookTitle") as string;
  const subject = formData.get("subject") as string;
  const docType = formData.get("docType") as string; // 'libro_teoria' | 'eserciziario' | 'tema_passato'
  const engineering = (formData.get("engineering") as string) || "tutti";
  const section = (formData.get("section") as string) || "tutti";
  const chapterCount = parseInt(formData.get("chapterCount") as string);

  if (!bookTitle || !subject || !docType || !chapterCount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();

  // Create the parent source document record
  const { data: doc, error: docError } = await supabase
    .from("source_documents")
    .insert({
      subject,
      doc_type: docType,
      title: bookTitle,
      engineering,
      section,
    })
    .select()
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Failed to create source document" }, { status: 500 });
  }

  const results: { chapter: string; extracted: number; error?: string }[] = [];
  let totalExtracted = 0;
  let globalLessonOrder = 1;

  // Process each chapter sequentially
  for (let i = 0; i < chapterCount; i++) {
    const file = formData.get(`chapter_file_${i}`) as File | null;
    const chapterTitle = formData.get(`chapter_title_${i}`) as string;

    if (!file || !chapterTitle) continue;

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    try {
      if (docType === "libro_teoria") {
        const lessons = await extractTheoryFromPdf(base64, subject, {
          bookTitle,
          chapterTitle,
          chapterIndex: i + 1,
          totalChapters: chapterCount,
        });

        if (lessons.length > 0) {
          // Assign global lesson order across chapters
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

        results.push({ chapter: chapterTitle, extracted: lessons.length });
        totalExtracted += lessons.length;
      } else {
        const exercises = await extractExercisesFromPdf(base64, subject, docType, {
          bookTitle,
          chapterTitle,
          chapterIndex: i + 1,
          totalChapters: chapterCount,
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

        results.push({ chapter: chapterTitle, extracted: exercises.length });
        totalExtracted += exercises.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({ chapter: chapterTitle, extracted: 0, error: msg });
    }
  }

  // Update totals on source document
  if (docType === "libro_teoria") {
    await supabase.from("source_documents").update({ lessons_extracted: totalExtracted }).eq("id", doc.id);
  } else {
    await supabase.from("source_documents").update({ exercises_extracted: totalExtracted }).eq("id", doc.id);
  }

  return NextResponse.json({ success: true, results, totalExtracted, documentId: doc.id });
}
