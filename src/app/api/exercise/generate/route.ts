import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateExercise } from "@/lib/claude";
import { isRateLimited } from "@/lib/rateLimit";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = { analisi1, analisi2 };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  // 30 exercise loads per hour per user (DB lookups are free; only Claude generation is expensive)
  if (isRateLimited(`gen:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste. Riprova tra un po'." }, { status: 429 });
  }

  const { subject, topicId, exerciseId } = await request.json();

  // If a specific exercise is requested, load it directly
  if (exerciseId) {
    const { data: ex } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", exerciseId)
      .single();
    if (!ex) return NextResponse.json({ error: "Esercizio non trovato" }, { status: 404 });
    const answers = ex.answers || [];
    const answerCount = Array.isArray(answers) ? answers.filter((a: { type: string }) => a.type === "exact").length : 0;
    return NextResponse.json({
      id: ex.id,
      text: ex.question_latex,
      solution: ex.solution_latex,
      difficulty: ex.difficulty,
      hints: ex.hints || [],
      source: ex.source,
      fromDb: true,
      answerType: ex.answer_type || "open",
      solutionExact: ex.solution_exact || null,
      solutionSteps: ex.solution_steps || [],
      conceptTags: ex.concept_tags || [],
      answerCount,
    });
  }

  const curriculum = curricula[subject];
  if (!curriculum) return NextResponse.json({ error: "Materia non trovata" }, { status: 400 });

  const topic = curriculum.topics.find((t) => t.id === topicId);
  if (!topic) return NextResponse.json({ error: "Argomento non trovato" }, { status: 400 });

  // Compute adaptive difficulty
  const { data: stats } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user.id)
    .eq("subject", subject)
    .eq("topic_id", topicId)
    .single();

  let difficulty = 1;
  if (stats && stats.exercises_done >= 3) {
    const rate = stats.correct / stats.exercises_done;
    if (rate >= 0.75) difficulty = 3;
    else if (rate >= 0.5) difficulty = 2;
  }

  // Get exercises already seen by this student
  const { data: seen } = await supabase
    .from("student_exercise_seen")
    .select("exercise_id")
    .eq("student_id", user.id);

  const seenIds = (seen || []).map((s) => s.exercise_id);

  // Try to fetch a pre-generated exercise from DB
  let dbQuery = supabase
    .from("exercises")
    .select("*")
    .eq("subject", subject)
    .eq("topic_id", topicId)
    .eq("difficulty", difficulty);

  if (seenIds.length > 0) {
    dbQuery = dbQuery.not("id", "in", `(${seenIds.join(",")})`);
  }

  const { data: dbExercises } = await dbQuery.limit(10);

  if (dbExercises && dbExercises.length > 0) {
    // Pick a random one from results
    const picked = dbExercises[Math.floor(Math.random() * dbExercises.length)];

    // Mark as seen
    await supabase
      .from("student_exercise_seen")
      .upsert({ student_id: user.id, exercise_id: picked.id });

    const pickedAnswers = picked.answers || [];
    const pickedAnswerCount = Array.isArray(pickedAnswers) ? pickedAnswers.filter((a: { type: string }) => a.type === "exact").length : 0;
    return NextResponse.json({
      id: picked.id,
      text: picked.question_latex,
      solution: picked.solution_latex,
      difficulty: picked.difficulty,
      hints: picked.hints || [],
      source: picked.source,
      fromDb: true,
      answerType: picked.answer_type || "open",
      solutionExact: picked.solution_exact || null,
      solutionSteps: picked.solution_steps || [],
      conceptTags: picked.concept_tags || [],
      answerCount: pickedAnswerCount,
    });
  }

  // Fallback: if DB is empty for this topic, generate with Claude
  const { data: allStats } = await supabase
    .from("topic_stats")
    .select("topic_id, exercises_done, correct, last_error_types")
    .eq("student_id", user.id)
    .eq("subject", subject);

  const profile = { topicStats: allStats || [] };

  try {
    const exercise = await generateExercise(
      subject, topicId, topic.name, topic.subtopics, difficulty, profile
    );
    return NextResponse.json({ ...exercise, text: exercise.text, fromDb: false });
  } catch (err) {
    console.error("Exercise generation error:", err);
    return NextResponse.json({ error: "Errore nella generazione" }, { status: 500 });
  }
}
