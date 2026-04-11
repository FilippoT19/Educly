import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface RecommendationItem {
  exerciseId: string;
  topicId: string;
  reason: string;
  questionPreview: string; // truncated question_latex for preview
  isTop: boolean;
}

function truncatePreview(latex: string, maxChars = 350): string {
  const clean = latex.replace(/\n+/g, " ").trim();
  return clean.length > maxChars ? clean.slice(0, maxChars) + "…" : clean;
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
    targetTopicId    = currentTopicId;
    targetDifficulty = 1;
    reason = "Hai avuto difficoltà. Riprova con esercizi più semplici sullo stesso argomento.";
  } else if (score < 85) {
    targetTopicId = currentTopicId;
    reason = "Buon lavoro! Consolida questo argomento con altri esercizi simili.";
  } else {
    if (masteryMap.size > 0) {
      const weakestConcept = [...masteryMap.entries()]
        .filter(([c]) => {
          const row = (masteryRows ?? []).find(r => r.concept === c);
          return (row?.attempts ?? 0) >= 1;
        })
        .sort(([, a], [, b]) => a - b)[0];

      if (weakestConcept && weakestConcept[1] < 0.65) {
        targetConceptTags = [weakestConcept[0]];
        reason = `Ottimo! Hai ancora margine su "${weakestConcept[0].replace(/_/g, " ")}" — ecco esercizi mirati.`;
      } else {
        targetDifficulty = 3;
        reason = "Eccellente! Prova questi esercizi più difficili per continuare a crescere.";
      }
    } else {
      targetDifficulty = 3;
      reason = "Eccellente! Prova questi esercizi più difficili per continuare a crescere.";
    }
  }

  // 4. Build query — include question_latex for previews
  let query = supabase
    .from("exercises")
    .select("id, topic_id, difficulty, concept_tags, question_latex")
    .eq("subject", subject);

  if (!targetConceptTags) {
    query = query.eq("topic_id", targetTopicId);
  }
  if (targetDifficulty) query = query.eq("difficulty", targetDifficulty);
  if (currentExerciseId) query = query.neq("id", currentExerciseId);

  const { data: candidates } = await query.limit(60);

  let pool = (candidates ?? []).filter(e => !passedIds.has(e.id));

  // 5. Score candidates if targeting a concept
  type Candidate = { id: string; topic_id: string; difficulty: number; concept_tags: string[] | null; question_latex: string };

  let scoredPool: { e: Candidate; score: number }[];

  if (targetConceptTags && pool.length > 0) {
    const targetSet = new Set(targetConceptTags);
    scoredPool = pool
      .map(e => {
        const tags: string[] = Array.isArray(e.concept_tags) ? e.concept_tags : [];
        const overlap = tags.filter(t => targetSet.has(t)).length;
        const weaknessScore = tags.reduce((sum, t) => {
          const m = masteryMap.get(t);
          return sum + (m !== undefined ? 1 - m : 0.5);
        }, 0);
        return { e, score: overlap * 2 + weaknessScore };
      })
      .sort((a, b) => b.score - a.score);
  } else {
    // Shuffle pool for variety
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    scoredPool = shuffled.map(e => ({ e, score: 0 }));
  }

  // 6. Take top 3, trying to vary difficulty or topic slightly
  const picks: Candidate[] = [];
  for (const { e } of scoredPool) {
    if (picks.length >= 3) break;
    picks.push(e);
  }

  // 7. If not enough, fill from any subject exercise (excluding current)
  if (picks.length < 3) {
    let fallbackQuery = supabase
      .from("exercises")
      .select("id, topic_id, difficulty, concept_tags, question_latex")
      .eq("subject", subject);
    if (currentExerciseId) fallbackQuery = fallbackQuery.neq("id", currentExerciseId);
    const { data: fb } = await fallbackQuery.limit(30);
    const fbPool = (fb ?? [])
      .filter(e => !passedIds.has(e.id) && !picks.some(p => p.id === e.id))
      .sort(() => Math.random() - 0.5);
    for (const e of fbPool) {
      if (picks.length >= 3) break;
      picks.push(e);
    }
  }

  if (picks.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  const recommendations: RecommendationItem[] = picks.map((pick, i) => ({
    exerciseId: pick.id,
    topicId: pick.topic_id,
    reason,
    questionPreview: truncatePreview(pick.question_latex ?? ""),
    isTop: i === 0,
  }));

  return NextResponse.json({ recommendations });
}
