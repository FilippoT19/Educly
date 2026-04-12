export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractExercisesFromPdf } from "@/lib/ingestion";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function POST(request: NextRequest) {
  // Simple secret-based auth for admin
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const subject = formData.get("subject") as string;
  const source = formData.get("source") as string;
  const title = formData.get("title") as string;
  const engineering = (formData.get("engineering") as string) || "tutti";
  const section = (formData.get("section") as string) || "tutti";
  const year = formData.get("year") ? parseInt(formData.get("year") as string) : undefined;

  if (!file || !subject || !source || !title) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Convert PDF to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    const exercises = await extractExercisesFromPdf(base64, subject, source, { sourceYear: year });

    const supabase = await createClient();

    // Save source document record
    const { data: doc } = await supabase
      .from("source_documents")
      .insert({ subject, doc_type: source, title, year: year || null, exercises_extracted: exercises.length, engineering, section })
      .select()
      .single();

    // Save all exercises
    const { error } = await supabase.from("exercises").insert(
      exercises.map((e) => ({
        subject,
        topic_id: e.topic_id,
        difficulty: e.difficulty,
        source,
        source_year: year || null,
        question_latex: e.question_latex,
        solution_latex: e.solution_latex,
        hints: e.hints,
        tags: e.tags,
        engineering,
        section,
      }))
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      extracted: exercises.length,
      documentId: doc?.id,
    });
  } catch (err) {
    console.error("Exercise extraction error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
