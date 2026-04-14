import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { exerciseId, subject, topicId, wasCorrect } = await request.json();

  // Delete the most recent exercise_attempt for this student/exercise
  if (exerciseId) {
    const { data: attempt } = await supabase
      .from("exercise_attempts")
      .select("id")
      .eq("student_id", user.id)
      .eq("exercise_id", exerciseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (attempt) {
      await supabase.from("exercise_attempts").delete().eq("id", attempt.id);
    }
  }

  // Decrement topic_stats
  const { data: existing } = await supabase
    .from("topic_stats")
    .select("id, exercises_done, correct")
    .eq("student_id", user.id)
    .eq("subject", subject)
    .eq("topic_id", topicId)
    .single();

  if (existing && existing.exercises_done > 0) {
    await supabase
      .from("topic_stats")
      .update({
        exercises_done: Math.max(0, existing.exercises_done - 1),
        correct: Math.max(0, existing.correct - (wasCorrect ? 1 : 0)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }

  return NextResponse.json({ ok: true });
}
