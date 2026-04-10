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
    .select("exercise_id, is_correct")
    .eq("student_id", user.id);

  const passedIds = new Set(
    (attempts ?? []).filter(a => a.is_correct).map(a => a.exercise_id)
  );

  // 2. Load concept mastery for this subject
  const { data: masteryRows } = await supabase
    .from("concept_mastery")
    .select("concept, mastery, attempts")
    .eq("student_id", user.id)
    .eq("subject", subject);

  const masteryMap = new Map(
    (masteryRows ?? []).map((r) => [r.concept, r.mastery as number])
  );

  // 3. Decide strategy based on score
  let targetTopicId: string = currentTopicId;
  let targetDifficulty: number | null = null;
  let reason: string;
  let targetConceptTags: string[] | null = null;

  if (score < 50) {
    // Failed badly → same topic, easier, target weak concepts
    targetTopicId    = currentTopicId;
    targetDifficulty = 1;
    reason = "Hai avuto difficoltà. Riprova con un esercizio più semplice sullo stesso argomento.";
  } else if (score < 85) {
    // Partial → same topic, same difficulty
    targetTopicId = currentTopicId;
    reason = "Buon lavoro! Consolida questo argomento con un altro esercizio simile.";
  } else {
    // Good → find weakest concept across the subject and target it
    if (masteryMap.size > 0) {
      // Find the weakest concept (lowest mastery, min 2 attempts)
      const weakestConcept = [...masteryMap.entries()]
        .filter(([c]) => {
          const row = (masteryRows ?? []).find(r => r.concept === c);
          return (row?.attempts ?? 0) >= 1;
        })
        .sort(([, a], [, b]) => a - b)[0];

      if (weakestConcept && weakestConcept[1] < 0.65) {
        targetConceptTags = [weakestConcept[0]];
        reason = `Ottimo risultato! Hai ancora margine su "${weakestConcept[0].replace(/_/g, " ")}" — proviamo a lavorarci.`;
      } else {
        targetDifficulty = 3;
        reason = "Eccellente! Prova qualcosa di più difficile per continuare a crescere.";
      }
    } else {
      targetDifficulty = 3;
      reason = "Eccellente! Prova qualcosa di più difficile per continuare a crescere.";
    }
  }

  // 4. Build query
  let query = supabase
    .from("exercises")
    .select("id, topic_id, difficulty, concept_tags")
    .eq("subject", subject);

  if (!targetConceptTags) {
    query = query.eq("topic_id", targetTopicId);
  }
  if (targetDifficulty) query = query.eq("difficulty", targetDifficulty);
  if (currentExerciseId) query = query.neq("id", currentExerciseId);

  const { data: candidates } = await query.limit(50);

  let pool = (candidates ?? []).filter(e => !passedIds.has(e.id));

  // 5. If targeting a concept, score candidates by overlap with weak concepts
  if (targetConceptTags && pool.length > 0) {
    const targetSet = new Set(targetConceptTags);
    const scored = pool
      .map(e => {
        const tags: string[] = Array.isArray(e.concept_tags) ? e.concept_tags : [];
        const overlap = tags.filter(t => targetSet.has(t)).length;
        // Also factor in overall concept weakness score
        const weaknessScore = tags.reduce((sum, t) => {
          const m = masteryMap.get(t);
          return sum + (m !== undefined ? 1 - m : 0.5);
        }, 0);
        return { e, score: overlap * 2 + weaknessScore };
      })
      .sort((a, b) => b.score - a.score);

    // Pick from top candidates with some randomness
    const top = scored.slice(0, Math.min(5, scored.length));
    pool = top.map(s => s.e);
  }

  // 6. Fallback: any exercise in the subject
  if (pool.length === 0) {
    const fullPool = (candidates ?? []);
    if (fullPool.length === 0) {
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
    pool = fullPool;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];

  return NextResponse.json({
    recommendation: {
      exerciseId: pick.id,
      topicId: pick.topic_id,
      reason,
    } satisfies Recommendation,
  });
}
