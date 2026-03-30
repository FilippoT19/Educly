import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface StudentProfile {
  topicStats: {
    topic_id: string;
    exercises_done: number;
    correct: number;
    last_error_types: string[];
  }[];
}

export interface GeneratedExercise {
  text: string;
  difficulty: number;
  hints: string[];
}

export interface CorrectionResult {
  isCorrect: boolean;
  score: number; // 0-100
  errorTypes: string[];
  feedback: string;
  whatToReview: string[];
}

export async function generateExercise(
  subject: string,
  topicId: string,
  topicName: string,
  subtopics: string[],
  difficulty: number,
  profile: StudentProfile
): Promise<GeneratedExercise> {
  const weakAreas = profile.topicStats
    .filter((s) => s.exercises_done > 0 && s.correct / s.exercises_done < 0.6)
    .map((s) => s.topic_id);

  const recentErrors = profile.topicStats
    .flatMap((s) => s.last_error_types)
    .slice(0, 5);

  const difficultyLabel = difficulty === 1 ? "facile" : difficulty === 2 ? "medio" : "difficile";

  const prompt = `Sei un professore di ${subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2"} al Politecnico italiano.

Genera UN esercizio di livello ${difficultyLabel} sull'argomento: **${topicName}**.
Sottotemi coperti: ${subtopics.join(", ")}.

${weakAreas.length > 0 ? `Lo studente ha difficoltà in: ${weakAreas.join(", ")}. Se possibile, collega l'esercizio a questi argomenti.` : ""}
${recentErrors.length > 0 ? `Errori recenti dello studente: ${recentErrors.join(", ")}. Crea un esercizio che permetta di rilevare questi errori.` : ""}

Rispondi SOLO in formato JSON valido con questa struttura:
{
  "text": "testo completo dell'esercizio in LaTeX (usa $...$ per formule inline e $$...$$ per formule display)",
  "difficulty": ${difficulty},
  "hints": ["suggerimento 1", "suggerimento 2"]
}

Il testo deve essere chiaro, preciso e realistico come un esercizio da esame del Politecnico.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]) as GeneratedExercise;
}

export async function correctExercise(
  subject: string,
  topicName: string,
  exerciseText: string,
  imageBase64: string,
  imageMediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
): Promise<CorrectionResult> {
  const prompt = `Sei un professore di ${subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2"} al Politecnico italiano.

Stai correggendo la soluzione di uno studente per il seguente esercizio:

ESERCIZIO:
${exerciseText}

Nell'immagine allegata c'è la soluzione scritta a mano dallo studente (scritta con Apple Pencil su GoodNotes o simili).

Analizza attentamente la soluzione e rispondi SOLO in formato JSON valido con questa struttura:
{
  "isCorrect": true/false,
  "score": numero da 0 a 100,
  "errorTypes": ["tipo di errore 1", "tipo di errore 2"],
  "feedback": "spiegazione dettagliata di cosa ha fatto bene e dove ha sbagliato, con la soluzione corretta",
  "whatToReview": ["argomento da ripassare 1", "argomento da ripassare 2"]
}

Per errorTypes usa categorie chiare come: "errore di calcolo", "errore di segno", "passaggio mancante", "formula sbagliata", "impostazione errata", "errore di integrazione", "errore di derivazione", ecc.

Sii preciso e costruttivo nel feedback. Se l'esercizio è corretto, confermalo con entusiasmo.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageMediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]) as CorrectionResult;
}
