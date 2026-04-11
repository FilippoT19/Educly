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

export interface CorrectionStep {
  step: number;
  label: string;       // e.g. "Impostazione dell'integrale"
  correct: boolean;
  comment: string;     // LaTeX-formatted explanation
}

export interface CorrectionResult {
  isCorrect: boolean;
  score: number; // 0-100
  errorTypes: string[];
  steps: CorrectionStep[];
  solutionLatex: string;  // full correct solution in LaTeX
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
  imageMediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  hintsUsed: boolean = false
): Promise<CorrectionResult> {
  const maxScore = hintsUsed ? 70 : 100;

  const prompt = `Sei un professore severo di ${subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2"} al Politecnico italiano.

Stai correggendo la soluzione di uno studente per il seguente esercizio:

ESERCIZIO:
${exerciseText}

Nell'immagine allegata c'è la soluzione scritta a mano dallo studente.
${hintsUsed ? "\nATTENZIONE: Lo studente ha usato i suggerimenti. Il punteggio massimo assegnabile è 70." : ""}

Analizza la soluzione valutando SEPARATAMENTE questi tre aspetti:
1. IMPOSTAZIONE (25 pt): ha impostato correttamente il problema? Ha identificato il metodo giusto?
2. PROCEDIMENTO (50 pt): ha eseguito i passaggi in modo corretto? Il procedimento è logico e completo?
3. RISULTATO FINALE (25 pt): il risultato finale è corretto?

IMPORTANTE per il punteggio:
- Un'impostazione corretta da sola non vale più di 25 punti
- Se il procedimento è sbagliato, il punteggio NON può superare 40 anche se l'impostazione è corretta
- Se il risultato finale è sbagliato, il punteggio NON può superare 70
- isCorrect = true SOLO se score >= 85
${hintsUsed ? "- Il punteggio massimo finale è 70 (suggerimenti usati)" : ""}

Rispondi SOLO in formato JSON valido con questa struttura:
{
  "isCorrect": true/false,
  "score": numero da 0 a ${maxScore},
  "errorTypes": ["tipo di errore in italiano semplice, NO LaTeX, NO markdown"],
  "steps": [
    {
      "step": 1,
      "label": "Impostazione",
      "correct": true/false,
      "comment": "spiegazione con LaTeX per le formule: $\\\\frac{d}{dx}x^2 = 2x$"
    },
    {
      "step": 2,
      "label": "Procedimento",
      "correct": true/false,
      "comment": "descrivi gli errori specifici nel procedimento con formule LaTeX"
    },
    {
      "step": 3,
      "label": "Risultato finale",
      "correct": true/false,
      "comment": "il risultato ottenuto vs il risultato corretto in LaTeX"
    }
  ],
  "solutionLatex": "soluzione corretta completa passo-passo, usa $...$ per inline e $$...$$ per display",
  "whatToReview": ["argomento da ripassare in testo semplice italiano, NO LaTeX"]
}

Regole di formato:
- Usa LaTeX ($...$) SOLO nei campi comment e solutionLatex, mai in errorTypes o whatToReview
- Non usare mai \\\\mathbf, \\\\textbf, \\\\textit, né markdown (**testo**)
- Per errorTypes usa etichette brevi: "errore di calcolo", "errore di segno", "passaggio mancante", "formula sbagliata", "impostazione errata", "errore di procedimento", "risultato errato"
- whatToReview: testo semplice italiano, es. "Regola di integrazione per parti"`;



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

export interface SolutionStep {
  step: number;
  title: string;       // short title, plain text (e.g. "Impostazione dell'integrale")
  text: string;        // one-sentence explanation, plain text, no LaTeX
  formula: string;     // key formula for this step in LaTeX (will render as $$...$$)
  detail: string;      // full explanation with LaTeX (shown in accordion)
  weight: number;      // partial-credit weight (all steps sum to 75)
}

export interface ExerciseAnswer {
  label: string;    // "Risultato", "a)", "b)", etc.
  type: "exact" | "open";
  value?: string;   // expected answer for exact type (normalized, no LaTeX delimiters)
}

export interface AnswerCheckResult {
  isCorrect: boolean;
  correctAnswer: string;   // the correct final answer (LaTeX inline: $...$)
  solutionSteps: SolutionStep[];
}

export async function correctAnswer(
  subject: string,
  topicName: string,
  exerciseText: string,
  studentAnswer: string,
): Promise<AnswerCheckResult> {
  const prompt = `Sei un professore di ${subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2"} al Politecnico italiano.

ESERCIZIO:
${exerciseText}

RISPOSTA DELLO STUDENTE:
${studentAnswer}

Il tuo compito:
1. Determina se la risposta dello studente è matematicamente corretta (accetta notazioni equivalenti: π/2 = pi/2, √2 = sqrt(2), ecc.)
2. Suddividi la soluzione in passaggi logici (da 3 a 6 passaggi)
3. Per ogni passaggio fornisci: titolo, spiegazione testo, formula chiave, spiegazione dettagliata
4. I pesi devono sommare esattamente 75

Rispondi SOLO in formato JSON valido:
{
  "isCorrect": true/false,
  "correctAnswer": "risultato finale in LaTeX inline, es: $\\\\frac{\\\\pi}{4}$",
  "solutionSteps": [
    {
      "step": 1,
      "title": "Titolo del passaggio (testo semplice, NO LaTeX)",
      "text": "Spiegazione in una frase, testo semplice senza formule.",
      "formula": "formula principale di questo passaggio in LaTeX puro (senza $ delimitatori), es: \\\\int_0^1 x^2 dx",
      "detail": "Spiegazione dettagliata con formule $inline$ e $$display$$ LaTeX",
      "weight": 25
    }
  ]
}

Regole importanti:
- title e text: SOLO testo italiano, nessun LaTeX, nessun markdown
- formula: LaTeX puro senza $ delimitatori (il sistema li aggiunge automaticamente come display math)
- detail: testo + LaTeX con $...$ inline e $$...$$ per display
- Non usare markdown (**testo**, *testo*)
- correctAnswer: solo il risultato finale`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]) as AnswerCheckResult;
}

export async function correctExerciseText(
  subject: string,
  topicName: string,
  exerciseText: string,
  studentAnswer: string,
  hintsUsed: boolean = false
): Promise<CorrectionResult> {
  const maxScore = hintsUsed ? 70 : 100;

  const prompt = `Sei un professore severo di ${subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2"} al Politecnico italiano.

Stai correggendo la risposta testuale di uno studente per il seguente esercizio:

ESERCIZIO:
${exerciseText}

RISPOSTA DELLO STUDENTE:
${studentAnswer}
${hintsUsed ? "\nATTENZIONE: Lo studente ha usato i suggerimenti. Il punteggio massimo assegnabile è 70." : ""}

Analizza la risposta valutando SEPARATAMENTE questi tre aspetti:
1. IMPOSTAZIONE (25 pt): ha impostato correttamente il problema? Ha identificato il metodo giusto?
2. PROCEDIMENTO (50 pt): ha eseguito i passaggi in modo corretto? Il procedimento è logico e completo?
3. RISULTATO FINALE (25 pt): il risultato finale è corretto?

IMPORTANTE per il punteggio:
- Un'impostazione corretta da sola non vale più di 25 punti
- Se il procedimento è sbagliato, il punteggio NON può superare 40 anche se l'impostazione è corretta
- Se il risultato finale è sbagliato, il punteggio NON può superare 70
- isCorrect = true SOLO se score >= 85
${hintsUsed ? "- Il punteggio massimo finale è 70 (suggerimenti usati)" : ""}

Rispondi SOLO in formato JSON valido con questa struttura:
{
  "isCorrect": true/false,
  "score": numero da 0 a ${maxScore},
  "errorTypes": ["tipo di errore in italiano semplice, NO LaTeX, NO markdown"],
  "steps": [
    {
      "step": 1,
      "label": "Impostazione",
      "correct": true/false,
      "comment": "spiegazione con LaTeX per le formule: $\\\\frac{d}{dx}x^2 = 2x$"
    },
    {
      "step": 2,
      "label": "Procedimento",
      "correct": true/false,
      "comment": "descrivi gli errori specifici nel procedimento con formule LaTeX"
    },
    {
      "step": 3,
      "label": "Risultato finale",
      "correct": true/false,
      "comment": "il risultato ottenuto vs il risultato corretto in LaTeX"
    }
  ],
  "solutionLatex": "soluzione corretta completa passo-passo, usa $...$ per inline e $$...$$ per display",
  "whatToReview": ["argomento da ripassare in testo semplice italiano, NO LaTeX"]
}

Regole di formato:
- Usa LaTeX ($...$) SOLO nei campi comment e solutionLatex, mai in errorTypes o whatToReview
- Non usare mai \\\\mathbf, \\\\textbf, \\\\textit, né markdown (**testo**)
- Per errorTypes usa etichette brevi: "errore di calcolo", "errore di segno", "passaggio mancante", "formula sbagliata", "impostazione errata", "errore di procedimento", "risultato errato"
- whatToReview: testo semplice italiano, es. "Regola di integrazione per parti"`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]) as CorrectionResult;
}

export async function populateExerciseData(
  subject: string,
  topicName: string,
  questionLatex: string,
  solutionLatex: string | null,
  conceptTaxonomy: string[] = [],
): Promise<{ answers: ExerciseAnswer[]; solutionSteps: SolutionStep[]; conceptTags: string[] }> {
  const subjectName = subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";

  const taxonomyBlock = conceptTaxonomy.length > 0
    ? `\nTASONOMIA DI CONCETTI DISPONIBILI (scegli 2-4 tra questi, SOLO da questa lista):\n${conceptTaxonomy.join(", ")}\n`
    : "";

  const prompt = `Sei un professore di ${subjectName} al Politecnico italiano.

Analizza questo esercizio e la sua soluzione:

ESERCIZIO:
${questionLatex}

${solutionLatex ? `SOLUZIONE COMPLETA:\n${solutionLatex}` : ""}
${taxonomyBlock}
Il tuo compito:
1. Identifica le domande dell'esercizio (di solito 1, a volte 2-3 per esercizi con parti a), b), c))
2. Per ogni domanda: determina se la risposta è "exact" (numero, formula semplice verificabile automaticamente) o "open" (dimostrazione, ragionamento)
3. Dividi la soluzione in 3-6 passaggi logici con pesi che sommano esattamente 75
4. Scegli tutti i concept_tags dalla tassonomia che descrivono concetti genuinamente testati da questo esercizio (tipicamente 2-6, ma possono essere di più per temi d'esame complessi — non aggiungere tag irrilevanti)

Rispondi SOLO in formato JSON:
{
  "answers": [
    {
      "label": "Risultato",
      "type": "exact",
      "value": "risposta normalizzata senza LaTeX, es: pi/4 oppure 3/2 oppure 0"
    }
  ],
  "solutionSteps": [
    {
      "step": 1,
      "title": "Titolo del passaggio (testo semplice)",
      "text": "Spiegazione breve in italiano, nessun LaTeX.",
      "formula": "formula principale in LaTeX puro senza delimitatori $, es: \\int_0^1 x^2 dx = \\frac{1}{3}",
      "detail": "Spiegazione dettagliata con LaTeX $inline$ e $$display$$",
      "weight": 25
    }
  ],
  "conceptTags": ["tag1", "tag2"]
}

Regole:
- answers.value: testo semplice normalizzato (es: "pi/4" non "\\frac{\\pi}{4}"), accetta varianti comuni
- type "open" se la risposta è una dimostrazione, un ragionamento, o non verificabile automaticamente
- solutionSteps.title e .text: SOLO testo italiano, nessun LaTeX
- solutionSteps.formula: LaTeX puro senza $ delimitatori
- I pesi devono sommare esattamente 75
- conceptTags: SOLO valori dalla tassonomia fornita, nessun tag inventato
- conceptTags: aggiungi tutti quelli rilevanti, senza limite artificiale`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]);
}
