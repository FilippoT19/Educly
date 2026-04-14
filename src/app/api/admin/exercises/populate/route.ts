import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { populateExerciseData } from "@/lib/claude";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1 & { conceptTaxonomy?: string[] }> = { analisi1, analisi2: analisi2 as unknown as (typeof analisi1 & { conceptTaxonomy?: string[] }) };

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

function getTopicName(subject: string, topicId: string): string {
  return curricula[subject]?.topics.find((t) => t.id === topicId)?.name ?? topicId;
}

function getConceptTaxonomy(subject: string): string[] {
  const curriculum = curricula[subject] as unknown as typeof analisi2 | undefined;
  return curriculum && "conceptTaxonomy" in curriculum ? curriculum.conceptTaxonomy : [];
}

type ExerciseRow = {
  question_latex: string | null;
  solution_latex: string | null;
  has_star: boolean | null;
  parts: Array<{ label: string; question_latex: string; solution_latex: string | null }> | null;
};

/**
 * Build the question and solution strings to send to Claude.
 * For multi-part exercises, concatenate all parts.
 * For non-starred: solution_latex is the final answer (brief).
 * For starred: solution_latex is the full worked solution.
 */
function buildTexts(ex: ExerciseRow): { questionText: string; solutionText: string | null } {
  const parts = ex.parts ?? [];

  if (parts.length > 0) {
    const preamble = ex.question_latex ?? "";
    const questionText = [
      preamble,
      ...parts.map((p) => `Parte ${p.label.toUpperCase()}:\n${p.question_latex}`),
    ].filter(Boolean).join("\n\n");

    const solutionParts = parts
      .filter((p) => p.solution_latex)
      .map((p) => `Parte ${p.label.toUpperCase()}:\n${p.solution_latex}`);
    const solutionText = solutionParts.length > 0 ? solutionParts.join("\n\n") : null;

    return { questionText, solutionText };
  }

  return { questionText: ex.question_latex ?? "", solutionText: ex.solution_latex };
}

// Fallback when Claude can't parse the exercise
const OPEN_FALLBACK = {
  answers: [{ label: "Soluzione", type: "open" as const }],
  solutionSteps: [] as never[],
  conceptTags: [] as string[],
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

  // "Not yet AI-populated" = concept_tags is empty (set by upload script default, filled by AI)
  const { count: totalRemaining } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("subject", subject)
    .or("concept_tags.eq.{},concept_tags.is.null");

  // Get next N exercises to process
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id, subject, topic_id, question_latex, solution_latex, has_star, parts")
    .eq("subject", subject)
    .or("concept_tags.eq.{},concept_tags.is.null")
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!exercises || exercises.length === 0) {
    return NextResponse.json({ processed: 0, remaining: 0 });
  }

  const taxonomy = getConceptTaxonomy(subject);
  let processed = 0;

  for (const ex of exercises) {
    try {
      const topicName = getTopicName(ex.subject, ex.topic_id);
      const { questionText, solutionText } = buildTexts(ex);
      const result = await populateExerciseData(
        ex.subject,
        topicName,
        questionText,
        solutionText,
        taxonomy,
      );

      await supabase
        .from("exercises")
        .update({
          answers: result.answers,
          solution_steps: result.solutionSteps,
          concept_tags: result.conceptTags,
        })
        .eq("id", ex.id);
    } catch {
      await supabase
        .from("exercises")
        .update({
          answers: OPEN_FALLBACK.answers,
          solution_steps: OPEN_FALLBACK.solutionSteps,
          concept_tags: ["da_rivedere"],  // non-empty so it's not re-processed
        })
        .eq("id", ex.id);
    }
    processed++;
  }

  const remaining = Math.max(0, (totalRemaining ?? 0) - processed);
  return NextResponse.json({ processed, remaining });
}
