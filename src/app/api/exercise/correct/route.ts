import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctExercise } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const formData = await request.formData();
  const subject = formData.get("subject") as string;
  const topicId = formData.get("topicId") as string;
  const topicName = formData.get("topicName") as string;
  const exerciseText = formData.get("exerciseText") as string;
  const difficulty = parseInt(formData.get("difficulty") as string);
  const imageFile = formData.get("image") as File;

  if (!imageFile) {
    return NextResponse.json({ error: "Immagine mancante" }, { status: 400 });
  }

  // Convert file to base64
  const arrayBuffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = imageFile.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  // Upload image to Supabase Storage
  const filePath = `${user.id}/${Date.now()}.${imageFile.name.split(".").pop()}`;
  const { data: uploadData } = await supabase.storage
    .from("solutions")
    .upload(filePath, imageFile);

  const imageUrl = uploadData?.path || null;

  try {
    const correction = await correctExercise(subject, topicName, exerciseText, base64, mediaType);

    // Save to exercise log
    await supabase.from("exercise_log").insert({
      student_id: user.id,
      subject,
      topic_id: topicId,
      difficulty,
      exercise_text: exerciseText,
      solution_image_url: imageUrl,
      ai_feedback: correction.solutionLatex,
      error_types: correction.errorTypes,
      is_correct: correction.isCorrect,
    });

    // Update topic stats
    const { data: existing } = await supabase
      .from("topic_stats")
      .select("*")
      .eq("student_id", user.id)
      .eq("subject", subject)
      .eq("topic_id", topicId)
      .single();

    const prevErrors: string[] = existing?.last_error_types || [];
    const newErrors = [...correction.errorTypes, ...prevErrors].slice(0, 10);

    if (existing) {
      await supabase
        .from("topic_stats")
        .update({
          exercises_done: existing.exercises_done + 1,
          correct: existing.correct + (correction.isCorrect ? 1 : 0),
          last_error_types: newErrors,
          last_practiced: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("topic_stats").insert({
        student_id: user.id,
        subject,
        topic_id: topicId,
        exercises_done: 1,
        correct: correction.isCorrect ? 1 : 0,
        last_error_types: correction.errorTypes.slice(0, 10),
        last_practiced: new Date().toISOString(),
      });
    }

    return NextResponse.json(correction);
  } catch (err) {
    console.error("Correction error:", err);
    return NextResponse.json({ error: "Errore nella correzione" }, { status: 500 });
  }
}
