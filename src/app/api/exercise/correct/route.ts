import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctAnswer } from "@/lib/claude";
import { isRateLimited } from "@/lib/rateLimit";

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

  const { subject, topicName, exerciseText, studentAnswer } = await request.json();

  if (!studentAnswer?.trim()) {
    return NextResponse.json({ error: "Risposta mancante" }, { status: 400 });
  }

  try {
    const result = await correctAnswer(subject, topicName, exerciseText, studentAnswer.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("Correction error:", err);
    return NextResponse.json({ error: "Errore nella correzione" }, { status: 500 });
  }
}
