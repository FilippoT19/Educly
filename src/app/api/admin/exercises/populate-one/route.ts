import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { populateExerciseData } from "@/lib/claude";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = { analisi1, analisi2 };

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

function getTopicName(subject: string, topicId: string): string {
  return curricula[subject]?.topics.find((t) => t.id === topicId)?.name ?? topicId;
}

// Populate answers + solution_steps for a single exercise
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: ex, error } = await supabase
    .from("exercises")
    .select("id, subject, topic_id, question_latex, solution_latex")
    .eq("id", id)
    .single();

  if (error || !ex) {
    return NextResponse.json({ error: "Esercizio non trovato" }, { status: 404 });
  }

  const topicName = getTopicName(ex.subject, ex.topic_id);

  let result;
  try {
    result = await populateExerciseData(
      ex.subject,
      topicName,
      ex.question_latex,
      ex.solution_latex
    );
  } catch {
    // Complex exercise (matrices, open proofs, etc.) — mark as open-ended
    result = {
      answers: [{ label: "Soluzione", type: "open" as const }],
      solutionSteps: [],
    };
  }

  await supabase
    .from("exercises")
    .update({ answers: result.answers, solution_steps: result.solutionSteps })
    .eq("id", ex.id);

  return NextResponse.json(result);
}
