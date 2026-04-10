import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const {
    subject,
    topicId,
    exerciseId,
    exerciseText,
    studentAnswer,
    isCorrect,
    score,
    difficulty,
    fullSolution,
  } = await request.json();

  // Save to exercise log
  await supabase.from("exercise_log").insert({
    student_id: user.id,
    subject,
    topic_id: topicId,
    difficulty: difficulty ?? 1,
    exercise_text: exerciseText,
    student_answer: studentAnswer,
    ai_feedback: fullSolution,
    error_types: [],
    is_correct: isCorrect,
  });

  // Save attempt
  if (exerciseId) {
    await supabase.from("exercise_attempts").insert({
      student_id: user.id,
      exercise_id: exerciseId,
      is_correct: isCorrect,
      score,
    });
  }

  // Update topic stats
  const { data: existing } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user.id)
    .eq("subject", subject)
    .eq("topic_id", topicId)
    .single();

  if (existing) {
    await supabase
      .from("topic_stats")
      .update({
        exercises_done: existing.exercises_done + 1,
        correct: existing.correct + (isCorrect ? 1 : 0),
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
      correct: isCorrect ? 1 : 0,
      last_error_types: [],
      last_practiced: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
