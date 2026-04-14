export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";
import { anthropic } from "@/lib/claude";
import type { SolutionStep } from "@/lib/claude";

// 10 AI agent calls per day per user
const RATE_LIMIT = 10;
const RATE_WINDOW = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const guestEmail = process.env.GUEST_EMAIL ?? "guest@educly.app";
  if (user.email === guestEmail) {
    return NextResponse.json(
      { error: "Questa funzione non è disponibile per i guest." },
      { status: 403 }
    );
  }

  if (isRateLimited(`ai-agent:${user.id}`, RATE_LIMIT, RATE_WINDOW)) {
    return NextResponse.json(
      { error: "Limite giornaliero AI raggiunto (10 messaggi/giorno). Riprova domani." },
      { status: 429 }
    );
  }

  const { action, exerciseText, subject, steps, stepIndex, message } = await request.json();

  const subjectName = subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";

  try {
    if (action === "generate_steps") {
      const prompt = `Sei un professore di ${subjectName} al Politecnico italiano.

Genera una soluzione dettagliata passo-passo per questo esercizio:

ESERCIZIO:
${exerciseText}

Rispondi SOLO in formato JSON:
{
  "solutionSteps": [
    {
      "step": 1,
      "title": "Titolo del passaggio (testo semplice, no LaTeX)",
      "text": "Spiegazione breve in italiano, nessun LaTeX.",
      "formula": "formula principale in LaTeX puro senza delimitatori $",
      "detail": "Spiegazione dettagliata con LaTeX $inline$ e $$display$$",
      "weight": 25
    }
  ]
}

Regole:
- 3-6 passaggi logici
- title e text: SOLO testo italiano, nessun LaTeX
- formula: LaTeX puro senza $ delimitatori
- detail: testo + LaTeX con $...$ inline e $$...$$ per display
- I pesi devono sommare esattamente 75`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") throw new Error("Unexpected response type");

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");

      const data = JSON.parse(jsonMatch[0]) as { solutionSteps: SolutionStep[] };
      return NextResponse.json(data);
    }

    if (action === "explain_step") {
      const step = (steps as SolutionStep[])?.[stepIndex as number];
      if (!step) return NextResponse.json({ error: "Passaggio non trovato" }, { status: 400 });

      const prompt = `Sei un professore di ${subjectName} al Politecnico italiano.

ESERCIZIO:
${exerciseText}

Stai spiegando questo passaggio della soluzione:
Passaggio ${step.step}: ${step.title}
${step.text}
${step.formula ? `Formula: ${step.formula}` : ""}

Uno studente ha difficoltà con questo passaggio. Fornisci una spiegazione molto dettagliata e didattica, come se stessi spiegando a voce durante un ricevimento. Usa LaTeX per le formule ($...$ inline, $$...$$ display). Spiega il "perché" non solo il "come". Sii incoraggiante e chiaro.

IMPORTANTE: scrivi in testo semplice italiano. Non usare markdown (niente #, ##, **, *, -, ecc.). Solo testo con LaTeX per le formule.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") throw new Error("Unexpected response type");

      return NextResponse.json({ explanation: content.text });
    }

    if (action === "chat") {
      if (!message?.trim()) return NextResponse.json({ error: "Messaggio vuoto" }, { status: 400 });

      const stepsContext = (steps as SolutionStep[])?.length
        ? `\nSOLUZIONE A PASSAGGI:\n${(steps as SolutionStep[]).map((s) => `${s.step}. ${s.title}: ${s.formula || s.text}`).join("\n")}`
        : "";

      const prompt = `Sei un tutor di ${subjectName} al Politecnico italiano. Stai aiutando uno studente con questo esercizio:

ESERCIZIO:
${exerciseText}
${stepsContext}

DOMANDA DELLO STUDENTE:
${message}

Rispondi in modo chiaro e didattico. Usa LaTeX per le formule ($...$ inline, $$...$$ display). Sii conciso ma completo.

IMPORTANTE: scrivi in testo semplice italiano. Non usare markdown (niente #, ##, **, *, -, ecc.). Solo testo con LaTeX per le formule.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") throw new Error("Unexpected response type");

      return NextResponse.json({ reply: content.text });
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (err) {
    console.error("AI agent error:", err);
    return NextResponse.json({ error: "Errore AI. Riprova." }, { status: 500 });
  }
}
