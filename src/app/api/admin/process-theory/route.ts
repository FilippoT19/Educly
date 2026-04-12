export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTheoryFromPdf } from "@/lib/ingestion";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const subject = formData.get("subject") as string;
  const title = formData.get("title") as string;
  const engineering = (formData.get("engineering") as string) || "tutti";
  const section = (formData.get("section") as string) || "tutti";

  if (!file || !subject || !title) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    const lessons = await extractTheoryFromPdf(base64, subject, {});

    const supabase = await createClient();

    // Save source document record
    const { data: doc } = await supabase
      .from("source_documents")
      .insert({ subject, doc_type: "libro_teoria", title, lessons_extracted: lessons.length, engineering, section })
      .select()
      .single();

    // Save all lessons
    const { error } = await supabase.from("theory_lessons").insert(
      lessons.map((l) => ({
        subject,
        topic_id: l.topic_id,
        lesson_order: l.lesson_order,
        title: l.title,
        content_markdown: l.content_markdown,
        key_concepts: l.key_concepts,
        mini_quiz: l.mini_quiz,
        engineering,
        section,
      }))
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      extracted: lessons.length,
      documentId: doc?.id,
    });
  } catch (err) {
    console.error("Theory extraction error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
