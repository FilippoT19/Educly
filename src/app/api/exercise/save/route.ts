import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

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
    conceptTags,
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

  // Update concept mastery (weighted average: new = old * 0.7 + score_normalized * 0.3)
  const tags: string[] = Array.isArray(conceptTags) ? conceptTags : [];
  if (tags.length > 0) {
    const scoreNormalized = Math.max(0, Math.min(1, (score ?? 0) / 100));

    // Fetch existing mastery rows for these concepts
    const { data: existingMastery } = await supabase
      .from("concept_mastery")
      .select("id, concept, mastery, attempts")
      .eq("student_id", user.id)
      .eq("subject", subject)
      .in("concept", tags);

    const existingMap = new Map(
      (existingMastery ?? []).map((row) => [row.concept, row])
    );

    for (const concept of tags) {
      const row = existingMap.get(concept);
      if (row) {
        const newMastery = row.mastery * 0.7 + scoreNormalized * 0.3;
        await supabase
          .from("concept_mastery")
          .update({
            mastery: newMastery,
            attempts: row.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } else {
        // First attempt: start from neutral 0.5, apply one update
        const newMastery = 0.5 * 0.7 + scoreNormalized * 0.3;
        await supabase.from("concept_mastery").insert({
          student_id: user.id,
          subject,
          concept,
          mastery: newMastery,
          attempts: 1,
        });
      }
    }
  }

  getPostHogClient().capture({
    distinctId: user.id,
    event: "exercise_saved",
    properties: {
      subject,
      topicId,
      exerciseId: exerciseId ?? null,
      isCorrect,
      score: score ?? null,
      difficulty: difficulty ?? 1,
    },
  });

  return NextResponse.json({ ok: true });
}
