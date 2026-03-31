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

export async function extractExercisesFromPdf(
  pdfBase64: string,
  subject: string,
  source: string,
  options: ExerciseOptions = {}
): Promise<ExtractedExercise[]> {
  const topicIds = getTopicIds(subject);
  const subjectName = subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";
  const { bookTitle, chapterTitle, chapterIndex, totalChapters } = options;

  const bookContext = bookTitle
    ? `\nContesto: questo PDF fa parte del libro "${bookTitle}"${chapterTitle ? `, capitolo ${chapterIndex}/${totalChapters}: "${chapterTitle}"` : ""}. Tieni presente questo contesto per classificare correttamente gli esercizi nei topic giusti.\n`
    : "";

  const prompt = `Sei un esperto di ${subjectName} al Politecnico italiano.
${bookContext}
Analizza questo documento (eserciziario o tema d'esame) ed estrai TUTTI gli esercizi che trovi.

Per ogni esercizio restituisci:
- topic_id: uno tra ${topicIds.join(", ")}
- difficulty: 1 (facile), 2 (medio), 3 (difficile)
- question_latex: testo completo dell'esercizio in LaTeX (usa $...$ inline e $$...$$ display)
- solution_latex: soluzione completa passo-passo in LaTeX
- hints: array di 2-3 suggerimenti
- tags: array di sottotemi specifici (es. ["integrazione_per_parti", "cambio_variabile"])

Rispondi SOLO con un array JSON valido:
[
  {
    "topic_id": "...",
    "difficulty": 1,
    "question_latex": "...",
    "solution_latex": "...",
    "hints": ["...", "..."],
    "tags": ["...", "..."]
  }
]

Estrai tutti gli esercizi che riesci a trovare nel documento. Se la soluzione non è nel documento, costruiscila tu in modo completo e corretto.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
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

  const bookContext = bookTitle
    ? `\nContesto: questo PDF fa parte del libro "${bookTitle}"${chapterTitle ? `, capitolo ${chapterIndex}/${totalChapters}: "${chapterTitle}"` : ""}. È importante che le lezioni estratte riflettano i contenuti specifici di questo capitolo e siano coerenti con il resto del libro.\n`
    : "";

  const prompt = `Sei un esperto di ${subjectName} al Politecnico italiano.
${bookContext}
Analizza questo libro/dispensa e crea lezioni di teoria strutturate.

Per ogni capitolo/argomento principale crea UNA lezione con:
- topic_id: uno tra ${topicIds.join(", ")}
- lesson_order: numero progressivo (1, 2, 3...)
- title: titolo della lezione
- content_markdown: contenuto completo in Markdown con formule LaTeX ($...$ inline, $$...$$ display). Deve essere chiaro, completo e didattico. Includi definizioni, teoremi, esempi e osservazioni importanti.
- key_concepts: array di 3-6 concetti chiave della lezione
- mini_quiz: array di 3 domande a scelta multipla per verificare la comprensione:
  { "question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0 }

Rispondi SOLO con un array JSON valido:
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
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
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
