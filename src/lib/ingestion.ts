import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface ExtractedExercise {
  topic_id: string;
  difficulty: 1 | 2 | 3;
  question_latex: string;
  solution_latex: string;
  hints: string[];
  tags: string[];
}

export interface ExtractedLesson {
  topic_id: string;
  lesson_order: number;
  title: string;
  content_markdown: string;
  key_concepts: string[];
  mini_quiz: { question: string; options: string[]; correct_index: number }[];
}

const TOPIC_IDS_ANALISI1 = [
  "insiemi_numeri", "successioni", "limiti", "continuita",
  "derivate", "taylor", "studio_funzione",
  "integrali_indefiniti", "integrali_definiti", "serie",
];

const TOPIC_IDS_ANALISI2 = [
  "funzioni_piu_variabili", "derivate_parziali", "ottimizzazione",
  "integrali_doppi", "integrali_tripli", "curve_integrali_curvilinei",
  "campi_vettoriali", "superfici", "edo", "serie_funzioni",
];

function getTopicIds(subject: string) {
  return subject === "analisi1" ? TOPIC_IDS_ANALISI1 : TOPIC_IDS_ANALISI2;
}

export interface ExerciseOptions {
  bookTitle?: string;
  chapterTitle?: string;
  chapterIndex?: number;
  totalChapters?: number;
  sourceYear?: number;
}

export interface TheoryOptions {
  bookTitle?: string;
  chapterTitle?: string;
  chapterIndex?: number;
  totalChapters?: number;
}

/**
 * Detects whether a chapter title indicates it is one part of a multi-part chapter.
 * e.g. "Capitolo 3 — Parte 2 di 3" or "Cap. 5 Parte 1"
 * Returns { isPartial: true, partLabel: "Parte 2 di 3" } or { isPartial: false }.
 */
function parseChapterPart(title: string): { isPartial: boolean; partLabel: string } {
  const match = title.match(/parte\s*(\d+)(?:\s*(?:di|\/)\s*(\d+))?/i);
  if (!match) return { isPartial: false, partLabel: "" };
  const partNum = match[1];
  const totalParts = match[2];
  const partLabel = totalParts ? `Parte ${partNum} di ${totalParts}` : `Parte ${partNum}`;
  return { isPartial: true, partLabel };
}

export async function extractExercisesFromPdf(
  pdfBase64: string,
  subject: string,
  source: string,
  options: ExerciseOptions = {}
): Promise<ExtractedExercise[]> {
  const topicIds = getTopicIds(subject);
  const subjectName = subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";
  const { bookTitle, chapterTitle, chapterIndex, totalChapters } = options;

  const { isPartial, partLabel } = chapterTitle ? parseChapterPart(chapterTitle) : { isPartial: false, partLabel: "" };

  let contextBlock = "";
  if (bookTitle && chapterTitle) {
    contextBlock = `
CONTESTO:
- Libro: "${bookTitle}"
- Capitolo ${chapterIndex} di ${totalChapters}: "${chapterTitle}"${isPartial ? `\n- Nota: questo PDF è solo la ${partLabel} del capitolo. Estrai tutti gli esercizi presenti in questa parte; verranno uniti con le altre parti dello stesso capitolo.` : ""}
`;
  }

  const prompt = `Sei un esperto di ${subjectName} al Politecnico italiano. Il documento è un PDF che può essere scannerizzato e può contenere testo, formule matematiche stampate o scritte a mano, e grafici. Sii preciso nell'interpretare il contenuto visivo.
${contextBlock}
Estrai TUTTI gli esercizi che trovi in questo documento.

Per ogni esercizio restituisci:
- topic_id: uno tra ${topicIds.join(", ")}
- difficulty: 1 (facile), 2 (medio), 3 (difficile)
- question_latex: testo completo dell'esercizio in LaTeX. Usa $...$ per formule inline e $$...$$ per display. Trascrivi fedelmente tutte le formule matematiche che vedi, anche se il documento è scannerizzato.
- solution_latex: soluzione completa passo-passo in LaTeX. Se la soluzione non è nel documento, costruiscila tu in modo corretto e dettagliato.
- hints: array di 2-3 suggerimenti strategici (non la soluzione completa)
- tags: array di sottotemi specifici es. ["integrazione_per_parti", "cambio_variabile"]

Rispondi SOLO con un array JSON valido, nessun testo prima o dopo:
[
  {
    "topic_id": "...",
    "difficulty": 2,
    "question_latex": "...",
    "solution_latex": "...",
    "hints": ["...", "..."],
    "tags": ["...", "..."]
  }
]`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in response");
  return JSON.parse(jsonMatch[0]) as ExtractedExercise[];
}

export async function extractTheoryFromPdf(
  pdfBase64: string,
  subject: string,
  options: TheoryOptions = {}
): Promise<ExtractedLesson[]> {
  const topicIds = getTopicIds(subject);
  const subjectName = subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";
  const { bookTitle, chapterTitle, chapterIndex, totalChapters } = options;

  const { isPartial, partLabel } = chapterTitle ? parseChapterPart(chapterTitle) : { isPartial: false, partLabel: "" };

  let contextBlock = "";
  if (bookTitle && chapterTitle) {
    contextBlock = `
CONTESTO:
- Libro: "${bookTitle}"
- Capitolo ${chapterIndex} di ${totalChapters}: "${chapterTitle}"${isPartial
  ? `\n- Nota: questo PDF è solo la ${partLabel} del capitolo. Estrai solo il contenuto presente in queste pagine — non inventare il contenuto delle altre parti. Le lezioni di questa parte verranno aggiunte in sequenza dopo quelle delle parti precedenti.`
  : ""}
`;
  }

  const prompt = `Sei un esperto di ${subjectName} al Politecnico italiano. Il documento è un PDF che può essere scannerizzato e può contenere testo, formule matematiche (stampate o scritte a mano), teoremi, dimostrazioni e grafici. Sii preciso nell'interpretare il contenuto visivo e trascrivi fedelmente tutto il materiale matematico.
${contextBlock}
Analizza questo materiale e crea lezioni di teoria strutturate.

Per ogni sezione/argomento distinto crea UNA lezione con:
- topic_id: uno tra ${topicIds.join(", ")}
- lesson_order: numero progressivo a partire da 1 (all'interno di questo PDF)
- title: titolo chiaro e descrittivo della lezione
- content_markdown: contenuto completo in Markdown con formule LaTeX ($...$ inline, $$...$$ display). Deve essere didattico, includere definizioni, enunciati di teoremi, eventuali dimostrazioni importanti, esempi numerici e osservazioni. Trascrivi fedelmente le formule dal PDF.
- key_concepts: array di 3-6 concetti chiave
- mini_quiz: array di 3 domande a scelta multipla:
  { "question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0 }

Rispondi SOLO con un array JSON valido, nessun testo prima o dopo:
[
  {
    "topic_id": "...",
    "lesson_order": 1,
    "title": "...",
    "content_markdown": "...",
    "key_concepts": ["...", "..."],
    "mini_quiz": [
      { "question": "...", "options": ["...", "...", "...", "..."], "correct_index": 0 }
    ]
  }
]`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in response");
  return JSON.parse(jsonMatch[0]) as ExtractedLesson[];
}
