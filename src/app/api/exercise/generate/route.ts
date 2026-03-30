import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateExercise } from "@/lib/claude";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = { analisi1, analisi2 };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { subject, topicId } = await request.json();

  const curriculum = curricula[subject];
  if (!curriculum) {
    return NextResponse.json({ error: "Materia non trovata" }, { status: 400 });
  }

  const topic = curriculum.topics.find((t) => t.id === topicId);
  if (!topic) {
    return NextResponse.json({ error: "Argomento non trovato" }, { status: 400 });
  }

  // Get student stats to calibrate difficulty
  const { data: stats } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user.id)
    .eq("subject", subject)
    .eq("topic_id", topicId)
    .single();

  // Adaptive difficulty: start easy, increase as student improves
  let difficulty = 1;
  if (stats && stats.exercises_done >= 3) {
    const rate = stats.correct / stats.exercises_done;
    if (rate >= 0.75) difficulty = 3;
    else if (rate >= 0.5) difficulty = 2;
  }

  // Get full profile for context
  const { data: allStats } = await supabase
    .from("topic_stats")
    .select("topic_id, exercises_done, correct, last_error_types")
    .eq("student_id", user.id)
    .eq("subject", subject);

  const profile = { topicStats: allStats || [] };

  try {
    const exercise = await generateExercise(
      subject,
      topicId,
      topic.name,
      topic.subtopics,
      difficulty,
      profile
    );
    return NextResponse.json(exercise);
  } catch (err) {
    console.error("Exercise generation error:", err);
    return NextResponse.json({ error: "Errore nella generazione" }, { status: 500 });
  }
}
