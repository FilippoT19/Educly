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

// Fallback when Claude can't parse the exercise
const OPEN_FALLBACK = {
  answers: [{ label: "Soluzione", type: "open" as const }],
  solutionSteps: [] as never[],
};

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { subject, limit = 5 } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Count total remaining
  const { count: totalRemaining } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("subject", subject)
    .or("answers.eq.[],answers.is.null");

  // Get next N exercises to process
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id, subject, topic_id, question_latex, solution_latex")
    .eq("subject", subject)
    .or("answers.eq.[],answers.is.null")
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!exercises || exercises.length === 0) {
    return NextResponse.json({ processed: 0, remaining: 0 });
  }

  let processed = 0;

  for (const ex of exercises) {
    try {
      const topicName = getTopicName(ex.subject, ex.topic_id);
      const result = await populateExerciseData(
        ex.subject,
        topicName,
        ex.question_latex,
        ex.solution_latex
      );

      await supabase
        .from("exercises")
        .update({ answers: result.answers, solution_steps: result.solutionSteps })
        .eq("id", ex.id);
    } catch {
      // Claude failed (timeout, bad JSON, complex exercise) — save as open so it's not retried
      await supabase
        .from("exercises")
        .update({ answers: OPEN_FALLBACK.answers, solution_steps: OPEN_FALLBACK.solutionSteps })
        .eq("id", ex.id);
    }
    processed++;
  }

  const remaining = Math.max(0, (totalRemaining ?? 0) - processed);
  return NextResponse.json({ processed, remaining });
}
