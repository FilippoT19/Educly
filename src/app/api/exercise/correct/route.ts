export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctAnswer } from "@/lib/claude";
import { isRateLimited } from "@/lib/rateLimit";
import { getPostHogClient } from "@/lib/posthog-server";
import type { ExerciseAnswer, SolutionStep, AnswerCheckResult } from "@/lib/claude";

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    // Remove all whitespace
    .replace(/\s+/g, "")
    // LaTeX → symbol
    .replace(/\\pi/g, "π").replace(/\bpi\b/g, "π")
    .replace(/\\infty/g, "∞").replace(/\binfty\b/g, "∞")
    // sqrt variants → √
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/sqrt\(([^)]+)\)/g, "√($1)")
    // LaTeX fractions → a/b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    // Remove outer wrapping parens from single terms: (3) → 3
    .replace(/^\(([^()]+)\)$/, "$1")
    // Common decimal ↔ fraction equivalences (normalize to fraction form)
    .replace(/\b0\.5\b/g, "1/2")
    .replace(/\b0\.25\b/g, "1/4")
    .replace(/\b0\.75\b/g, "3/4")
    .replace(/\b0\.1\b/g, "1/10")
    .replace(/\b0\.2\b/g, "1/5")
    .replace(/\b0\.333+\b/g, "1/3")
    .replace(/\b0\.666+\b/g, "2/3")
    // e^0 = 1
    .replace(/\be\^0\b/g, "1")
    .replace(/\be\^\{0\}/g, "1")
    // Remove LaTeX delimiters if student wraps answer
    .replace(/^\$+/, "").replace(/\$+$/, "")
    .replace(/^\\[\(\[]/, "").replace(/\\[\)\]]$/, "");
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

  // 30 corrections per hour per user
  if (isRateLimited(`correct:${user.id}`, 30, 60 * 60 * 1000)) {
    getPostHogClient().capture({
      distinctId: user.id,
      event: "rate_limit_hit",
      properties: { action: "exercise_correction" },
    });
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
        const allExact = answers.every((a) => a.type === "exact");

        if (allExact) {
          if (answers.length === 1) {
            // Single answer: compare directly
            const expected = answers[0].value ?? "";
            const isCorrect =
              normalizeAnswer(studentAnswer) === normalizeAnswer(expected);
            const correctAnswerStr = answers.map((a) => a.value ?? "").join(", ");

            const result: AnswerCheckResult = {
              isCorrect,
              correctAnswer: `$${correctAnswerStr}$`,
              solutionSteps: steps,
            };
            getPostHogClient().capture({
              distinctId: user.id,
              event: "exercise_corrected",
              properties: { subject, exerciseId, isCorrect, usedDb: true },
            });
            return NextResponse.json(result);
          }

          // Multiple exact answers (a, b, c parts):
          // Try to split student answer and compare each part
          const parts = studentAnswer
            .split(/[;,]/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 0);

          if (parts.length === answers.length) {
            const allMatch = answers.every(
              (a, i) =>
                normalizeAnswer(parts[i]) === normalizeAnswer(a.value ?? "")
            );
            const correctAnswerStr = answers
              .map((a) => `${a.label}: $${a.value ?? ""}$`)
              .join(" | ");

            const result: AnswerCheckResult = {
              isCorrect: allMatch,
              correctAnswer: correctAnswerStr,
              solutionSteps: steps,
            };
            getPostHogClient().capture({
              distinctId: user.id,
              event: "exercise_corrected",
              properties: { subject, exerciseId, isCorrect: allMatch, usedDb: true },
            });
            return NextResponse.json(result);
          }

          // Parts count mismatch or student wrote everything as one → fall through to Claude
        }
      }
    }

    // Fallback: use Claude
    const result = await correctAnswer(subject, topicName, exerciseText, studentAnswer.trim());
    getPostHogClient().capture({
      distinctId: user.id,
      event: "exercise_corrected",
      properties: { subject, exerciseId: exerciseId ?? null, isCorrect: result.isCorrect, usedDb: false },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Correction error:", err);
    return NextResponse.json({ error: "Errore nella correzione" }, { status: 500 });
  }
}
