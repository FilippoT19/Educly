import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctExerciseText } from "@/lib/claude";
import { isRateLimited } from "@/lib/rateLimit";
import type { CorrectionResult } from "@/lib/claude";

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\\pi/g, "π")
    .replace(/\bpi\b/g, "π")
    .replace(/\\infty/g, "∞")
    .replace(/\binfty\b/g, "∞")
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
    return NextResponse.json({ error: "Limite correzioni raggiunto. Riprova tra un po'." }, { status: 429 });
  }

  const body = await request.json();
  const {
    subject,
    topicId,
    topicName,
    exerciseText,
    difficulty,
    hintsUsed,
    studentAnswer,
    answerType,
    solutionExact,
    solutionLatex,
    solutionSteps,
  } = body as {
    subject: string;
    topicId: string;
    topicName: string;
    exerciseText: string;
    difficulty: number;
    hintsUsed: boolean;
    studentAnswer: string;
    answerType: "exact" | "open";
    solutionExact?: string;
    solutionLatex?: string;
    solutionSteps?: string[];
  };

  if (!studentAnswer?.trim()) {
    return NextResponse.json({ error: "Risposta mancante" }, { status: 400 });
  }

  try {
    let correction: CorrectionResult & { solutionSteps?: string[] };

    if (answerType === "exact" && solutionExact) {
      // No API call — compare normalized answers
      const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(solutionExact);
      const score = isCorrect ? (hintsUsed ? 70 : 100) : 0;

      correction = {
        isCorrect,
        score,
        errorTypes: isCorrect ? [] : ["risposta errata"],
        steps: [
          {
            step: 1,
            label: "Risultato",
            correct: isCorrect,
            comment: isCorrect
              ? `Corretto! La risposta è $${solutionExact}$.`
              : `La risposta corretta è $${solutionExact}$, tu hai scritto: ${studentAnswer}`,
          },
        ],
        solutionLatex: solutionLatex || solutionExact,
        whatToReview: isCorrect ? [] : [topicName],
        solutionSteps: solutionSteps || [],
      };
    } else {
      // Open-ended: use Claude for grading
      const result = await correctExerciseText(
        subject, topicName, exerciseText, studentAnswer, hintsUsed
      );
      correction = { ...result, solutionSteps: solutionSteps || [] };
    }

    // Save to exercise log
    await supabase.from("exercise_log").insert({
      student_id: user.id,
      subject,
      topic_id: topicId,
      difficulty,
      exercise_text: exerciseText,
      student_answer: studentAnswer,
      ai_feedback: correction.solutionLatex,
      error_types: correction.errorTypes,
      is_correct: correction.isCorrect,
    });

    // Update topic stats
    const { data: existing } = await supabase
      .from("topic_stats")
      .select("*")
      .eq("student_id", user.id)
      .eq("subject", subject)
      .eq("topic_id", topicId)
      .single();

    const prevErrors: string[] = existing?.last_error_types || [];
    const newErrors = [...correction.errorTypes, ...prevErrors].slice(0, 10);

    if (existing) {
      await supabase
        .from("topic_stats")
        .update({
          exercises_done: existing.exercises_done + 1,
          correct: existing.correct + (correction.isCorrect ? 1 : 0),
          last_error_types: newErrors,
          last_practiced: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("topic_stats").insert({
        student_id: user.id,
        subject,
        topic_id: topicId,
        exercises_done: 1,
        correct: correction.isCorrect ? 1 : 0,
        last_error_types: correction.errorTypes.slice(0, 10),
        last_practiced: new Date().toISOString(),
      });
    }

    return NextResponse.json(correction);
  } catch (err) {
    console.error("Correction error:", err);
    return NextResponse.json({ error: "Errore nella correzione" }, { status: 500 });
  }
}
