import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface Recommendation {
  exerciseId: string;
  topicId: string;
  reason: string;
}

// GET /api/exercise/recommend?subject=&topicId=&score=&currentExerciseId=
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = request.nextUrl.searchParams;
  const subject           = p.get("subject") ?? "";
  const currentTopicId    = p.get("topicId") ?? "";
  const score             = parseInt(p.get("score") ?? "0");
  const currentExerciseId = p.get("currentExerciseId") ?? null;

  // 1. Exercises the user has already passed → deprioritize
  const { data: attempts } = await supabase
    .from("exercise_attempts")
    .select("exercise_id, is_correct, score")
    .eq("student_id", user.id);

  const passedIds = new Set(
    (attempts ?? []).filter(a => a.is_correct).map(a => a.exercise_id)
  );

  // 2. Topic stats to find weak areas
  const { data: stats } = await supabase
    .from("topic_stats")
    .select("topic_id, exercises_done, correct")
    .eq("student_id", user.id)
    .eq("subject", subject);

  // 3. Decide target topic + difficulty + reason
  let targetTopicId: string = currentTopicId;
  let targetDifficulty: number | null = null;
  let reason: string;

  if (score < 50) {
    // Failed badly → same topic, easier
    targetTopicId  = currentTopicId;
    targetDifficulty = 1;
    reason = "Hai avuto difficoltà. Riprova con un esercizio più semplice sullo stesso argomento per rafforzare le basi.";
  } else if (score < 85) {
    // Partial → same topic, same difficulty
    targetTopicId = currentTopicId;
    reason = "Buon lavoro! Consolida questo argomento con un altro esercizio simile.";
  } else {
    // Good → try a topic the user is weak in, or a harder exercise
    const weakTopic = (stats ?? []).find(
      s => s.topic_id !== currentTopicId &&
           s.exercises_done > 0 &&
           s.correct / s.exercises_done < 0.6
    );
    const untried = (stats ?? []).length > 0
      ? null
      : null; // placeholder — we look for it below

    if (weakTopic) {
      targetTopicId = weakTopic.topic_id;
      reason = "Ottimo risultato! Hai ancora margine di miglioramento su questo argomento — proviamo a lavorarci.";
    } else {
      targetDifficulty = 3;
      reason = "Eccellente! Prova qualcosa di più difficile per continuare a crescere.";
    }
  }

  // 4. Query exercises matching target
  let query = supabase
    .from("exercises")
    .select("id, topic_id, difficulty")
    .eq("subject", subject)
    .eq("topic_id", targetTopicId);

  if (targetDifficulty) query = query.eq("difficulty", targetDifficulty);
  if (currentExerciseId) query = query.neq("id", currentExerciseId);

  const { data: candidates } = await query.limit(30);

  if (!candidates || candidates.length === 0) {
    // Fallback: any exercise in the subject, excluding current
    let fallback = supabase
      .from("exercises")
      .select("id, topic_id, difficulty")
      .eq("subject", subject);
    if (currentExerciseId) fallback = fallback.neq("id", currentExerciseId);
    const { data: fb } = await fallback.limit(20);
    if (!fb || fb.length === 0) return NextResponse.json({ recommendation: null });

    const pick = fb[Math.floor(Math.random() * fb.length)];
    return NextResponse.json({
      recommendation: {
        exerciseId: pick.id,
        topicId: pick.topic_id,
        reason: "Ecco un altro esercizio per continuare ad allenarti.",
      } satisfies Recommendation,
    });
  }

  // Prefer exercises not yet passed
  const pool = candidates.filter(e => !passedIds.has(e.id));
  const pick = pool.length > 0
    ? pool[Math.floor(Math.random() * pool.length)]
    : candidates[Math.floor(Math.random() * candidates.length)];

  return NextResponse.json({
    recommendation: {
      exerciseId: pick.id,
      topicId: pick.topic_id,
      reason,
    } satisfies Recommendation,
  });
}
