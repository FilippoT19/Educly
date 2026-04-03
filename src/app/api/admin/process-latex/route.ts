import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TOPIC_IDS: Record<string, string[]> = {
  analisi1: ["insiemi_numeri", "successioni", "limiti", "continuita", "derivate", "taylor", "studio_funzione", "integrali_indefiniti", "integrali_definiti", "serie"],
  analisi2: ["funzioni_piu_variabili", "derivate_parziali", "ottimizzazione", "integrali_doppi", "integrali_tripli", "curve_integrali_curvilinei", "campi_vettoriali", "superfici", "edo", "serie_funzioni"],
};

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sourceDocumentId, chapterTitle, latexContent, chapterIndex, totalChapters } = await request.json();

  if (!sourceDocumentId || !chapterTitle || !latexContent) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: doc, error: docErr } = await supabase
    .from("source_documents")
    .select("title, subject, doc_type, engineering, section")
    .eq("id", sourceDocumentId)
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const { title: bookTitle, subject, doc_type: docType, engineering, section } = doc;
  const topicIds = TOPIC_IDS[subject] ?? TOPIC_IDS["analisi1"];
  const subjectName = subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";

  const contextBlock = `
CONTESTO:
- Libro: "${bookTitle}"
- Capitolo${chapterIndex ? ` ${chapterIndex} di ${totalChapters}` : ""}: "${chapterTitle}"`;

  let prompt: string;

  const COMMON_RULES = `
REGOLE IMPORTANTI:
- Scrivi tutto in italiano corretto. I nomi di teoremi, lemmi e risultati devono essere in italiano (es. "teorema di Stokes", "teorema della divergenza", "criterio di Leibniz"), mai in inglese.
- Nei campi JSON usa SOLO testo semplice italiano e formule LaTeX matematiche. NON usare mai comandi LaTeX di formattazione testo come \\textbf, \\textit, \\emph, \\text{}, \\underline — scrivi solo testo piano.
- Per le formule usa $...$ per inline e $$...$$ per display.`;

  if (docType === "libro_teoria") {
    prompt = `Sei un esperto di ${subjectName} al Politecnico italiano. Ti fornisco il sorgente LaTeX di un capitolo di un libro di testo.
${contextBlock}
${COMMON_RULES}

Analizza il LaTeX e crea lezioni di teoria strutturate. Il LaTeX potrebbe contenere ambienti come \\begin{theorem}, \\begin{definition}, \\begin{example}, \\begin{proof}, ecc.

Per ogni sezione/argomento distinto crea UNA lezione con:
- topic_id: uno tra ${topicIds.join(", ")}
- lesson_order: numero progressivo a partire da 1
- title: titolo chiaro e descrittivo in italiano
- content_markdown: contenuto completo in Markdown con formule LaTeX ($...$ inline, $$...$$ display). Includi definizioni, teoremi, dimostrazioni, esempi.
- key_concepts: array di 3-6 concetti chiave in italiano
- mini_quiz: array di 3 domande a scelta multipla in italiano: { "question": "...", "options": ["A","B","C","D"], "correct_index": 0 }

Rispondi SOLO con un array JSON valido:
[{ "topic_id":"...", "lesson_order":1, "title":"...", "content_markdown":"...", "key_concepts":["..."], "mini_quiz":[{"question":"...","options":["...","...","...","..."],"correct_index":0}] }]

SORGENTE LATEX:
\`\`\`latex
${latexContent}
\`\`\``;
  } else {
    prompt = `Sei un esperto di ${subjectName} al Politecnico italiano. Ti fornisco il sorgente LaTeX di un documento con esercizi (eserciziario, tema d'esame, o dispensa).
${contextBlock}
${COMMON_RULES}

Analizza il LaTeX e identifica TUTTI gli esercizi con le loro soluzioni. Il LaTeX potrebbe usare ambienti come \\begin{exercise}, \\begin{problem}, \\begin{esercizio}, \\item, oppure sezioni numerate. Cerca anche gli ambienti \\begin{solution}, \\begin{soluzione}, \\begin{svolgimento} per le soluzioni.

Per ogni esercizio:
- topic_id: uno tra ${topicIds.join(", ")}
- difficulty: 1 (facile), 2 (medio), 3 (difficile)
- question_latex: testo completo della domanda. Testo in italiano semplice, formule in LaTeX.
- solution_latex: soluzione completa passo-passo in italiano. Se presente nel LaTeX usala; altrimenti costruiscila tu.
- hints: array di 2-3 suggerimenti strategici in italiano
- tags: array di 2-5 micro-argomenti in italiano es. ["integrazione per parti", "cambio di variabile", "teorema di Stokes"]

Rispondi SOLO con un array JSON valido:
[{ "topic_id":"...", "difficulty":2, "question_latex":"...", "solution_latex":"...", "hints":["..."], "tags":["..."] }]

SORGENTE LATEX:
\`\`\`latex
${latexContent}
\`\`\``;
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");
    const items = JSON.parse(jsonMatch[0]);

    if (docType === "libro_teoria") {
      const { data: maxRow } = await supabase
        .from("theory_lessons")
        .select("lesson_order")
        .eq("source_document_id", sourceDocumentId)
        .order("lesson_order", { ascending: false })
        .limit(1)
        .single();
      const lessonOrderStart = (maxRow?.lesson_order ?? 0) + 1;

      if (items.length > 0) {
        await supabase.from("theory_lessons").insert(
          items.map((l: Record<string, unknown>, idx: number) => ({
            subject, topic_id: l.topic_id, lesson_order: lessonOrderStart + idx,
            title: l.title, content_markdown: l.content_markdown,
            key_concepts: l.key_concepts, mini_quiz: l.mini_quiz,
            engineering, section, source_document_id: sourceDocumentId,
          }))
        );
      }
    } else {
      if (items.length > 0) {
        await supabase.from("exercises").insert(
          items.map((e: Record<string, unknown>) => ({
            subject, topic_id: e.topic_id, difficulty: e.difficulty,
            source: docType, question_latex: e.question_latex,
            solution_latex: e.solution_latex, hints: e.hints, tags: e.tags,
            engineering, section, source_document_id: sourceDocumentId,
          }))
        );
      }
    }

    return NextResponse.json({ extracted: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ extracted: 0, error: msg });
  }
}
