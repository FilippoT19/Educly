import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctAnswer } from "@/lib/claude";
import { isRateLimited } from "@/lib/rateLimit";
import type { ExerciseAnswer, SolutionStep, AnswerCheckResult } from "@/lib/claude";

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\\pi/g, "π").replace(/\bpi\b/g, "π")
    .replace(/\\infty/g, "∞").replace(/\binfty\b/g, "∞")
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const guestEmail = process.env.GUEST_EMAIL ?? "guest@educly.app";
  if (user.email === guestEmail) {
    return NextResponse.json(
      { error: "Questa funzione non è disponibile per i guest." },
      { status: 403 }
    );
  }

  // 10 corrections per hour per user
  if (isRateLimited(`correct:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Limite correzioni raggiunto. Riprova tra un po'." },
      { status: 429 }
    );
  }

  const { subject, topicName, exerciseText, studentAnswer, exerciseId } = await request.json();

  if (!studentAnswer?.trim()) {
    return NextResponse.json({ error: "Risposta mancante" }, { status: 400 });
  }

  try {
    // If exercise is from DB, check if we have pre-stored answers and steps
    if (exerciseId) {
      const { data: ex } = await supabase
        .from("exercises")
        .select("answers, solution_steps, solution_latex")
        .eq("id", exerciseId)
        .single();

      const answers = ex?.answers as ExerciseAnswer[] | null;
      const steps = ex?.solution_steps as SolutionStep[] | null;

      if (answers && answers.length > 0 && steps && steps.length > 0) {
        // All answers are exact — check without Claude
        const allExact = answers.every((a) => a.type === "exact");
        if (allExact) {
          // For single-answer exercises, compare the student's answer to the first exact answer
          const expected = answers[0].value ?? "";
          const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(expected);
          const correctAnswer = answers.map((a) => a.value ?? "").join(", ");

          const result: AnswerCheckResult = {
            isCorrect,
            correctAnswer: `$${correctAnswer}$`,
            solutionSteps: steps,
          };
          return NextResponse.json(result);
        }
      }
    }

    // Fallback: use Claude
    const result = await correctAnswer(subject, topicName, exerciseText, studentAnswer.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("Correction error:", err);
    return NextResponse.json({ error: "Errore nella correzione" }, { status: 500 });
  }
}
