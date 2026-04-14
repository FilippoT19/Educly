import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { exerciseId, subject, topicId, studentAnswer, reportedCorrectAnswer, appAnswer } =
    await request.json();

  // Save to DB
  await supabase.from("correction_reports").insert({
    student_id: user.id,
    exercise_id: exerciseId ?? null,
    subject,
    topic_id: topicId,
    student_answer: studentAnswer,
    app_answer: appAnswer,         // what the app said was correct
    reported_correct_answer: reportedCorrectAnswer ?? null,
    created_at: new Date().toISOString(),
  });

  // Telegram notification — awaited so Vercel doesn't kill it before it fires
  const webhookUrl = process.env.REPORT_WEBHOOK_URL;
  if (webhookUrl) {
    const text =
      `🚨 Segnalazione correzione errata\n\n` +
      `Studente: ${user.email}\n` +
      `Esercizio: ${exerciseId ?? "n/a"}\n` +
      `Materia: ${subject} / ${topicId}\n` +
      `Risposta studente: ${studentAnswer}\n` +
      `Risposta app: ${appAnswer}` +
      (reportedCorrectAnswer ? `\nRisposta corretta segnalata: ${reportedCorrectAnswer}` : "");

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch {
      // don't fail the request if Telegram is unreachable
    }
  }

  return NextResponse.json({ ok: true });
}
