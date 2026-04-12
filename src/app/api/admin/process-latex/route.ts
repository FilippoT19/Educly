import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { populateExerciseData } from "@/lib/claude";
import Anthropic from "@anthropic-ai/sdk";
import analisi2 from "@/content/analisi2.json";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TOPIC_IDS: Record<string, string[]> = {
  analisi1: ["insiemi_numeri", "successioni", "limiti", "continuita", "derivate", "taylor", "studio_funzione", "integrali_indefiniti", "integrali_definiti", "serie"],
  analisi2: ["funzioni_piu_variabili", "derivate_parziali", "ottimizzazione", "integrali_doppi", "integrali_tripli", "curve_integrali_curvilinei", "campi_vettoriali", "superfici", "edo", "serie_funzioni"],
};

const CONCEPT_TAXONOMIES: Record<string, string[]> = {
  analisi2: analisi2.conceptTaxonomy,
};

const OPEN_FALLBACK = {
  answers: [{ label: "Soluzione", type: "open" as const }],
  solutionSteps: [] as never[],
  conceptTags: [] as string[],
};

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sourceDocumentId, chapterTitle, latexContent, chapterIndex, totalChapters, imageUrls } = await request.json();

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
  const taxonomy = CONCEPT_TAXONOMIES[subject] ?? [];

  // Replace \includegraphics with actual image URLs if available, otherwise strip
  const urls: Record<string, string> = imageUrls ?? {};
  const cleanedLatex = latexContent
    // First handle full figure environments
    .replace(/\\begin\{figure\}([\s\S]*?)\\end\{figure\}/g, (_: string, inner: string) => {
      const match = inner.match(/\\includegraphics(?:\[.*?\])?\{([^}]+)\}/);
      if (!match) return "[FIGURA RIMOSSA]";
      const filename = match[1].replace(/^.*\//, ""); // bare filename
      const url = urls[match[1]] ?? urls[filename];
      return url ? `![figura](${url})` : "[FIGURA RIMOSSA]";
    })
    // Then handle standalone \includegraphics
    .replace(/\\includegraphics(?:\[.*?\])?\{([^}]+)\}/g, (_: string, path: string) => {
      const filename = path.replace(/^.*\//, "");
      const url = urls[path] ?? urls[filename];
      return url ? `![figura](${url})` : "[FIGURA RIMOSSA]";
    });

  const contextBlock = `
CONTESTO:
- Libro: "${bookTitle}"
- Capitolo${chapterIndex ? ` ${chapterIndex} di ${totalChapters}` : ""}: "${chapterTitle}"`;

  const COMMON_RULES = `
REGOLE IMPORTANTI:
- Scrivi tutto in italiano corretto. I nomi di teoremi, lemmi e risultati devono essere in italiano (es. "teorema di Stokes", "teorema della divergenza", "criterio di Leibniz"), mai in inglese.
- Nei campi JSON usa SOLO testo semplice italiano e formule LaTeX matematiche. NON usare mai comandi LaTeX di formattazione testo come \\textbf, \\textit, \\emph, \\text{}, \\underline — scrivi solo testo piano.
- Per le formule usa $...$ per inline e $$...$$ per display.
- Dove vedi ![figura](url): è un'immagine reale. Includila esattamente così com'è (![figura](url)) nel campo question_latex o solution_latex dove appare nel LaTeX originale. NON rimuoverla.
- Dove vedi [FIGURA RIMOSSA]: se la figura era essenziale per capire la domanda (es. "data la figura seguente..."), SALTA quell'esercizio. Se era solo illustrativa, processa normalmente.`;

  let prompt: string;

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
${cleanedLatex}
\`\`\``;
  } else {
    prompt = `Sei un esperto di ${subjectName} al Politecnico italiano. Ti fornisco il sorgente LaTeX di un documento con esercizi (eserciziario, tema d'esame, dispensa, oppure capitolo di libro).
${contextBlock}
${COMMON_RULES}

Analizza il LaTeX e identifica TUTTI gli esercizi e gli esempi con le loro soluzioni. Il documento può avere questa struttura tipica:
- Una sezione iniziale con ESEMPI (ambienti come \\begin{esempio}, \\begin{example}, \\begin{es}, oppure testo "Esempio X.Y" o "Es.") — questi sono esempi guidati con soluzione inclusa
- Una sezione con ESERCIZI numerati (ambienti come \\begin{esercizio}, \\begin{exercise}, \\begin{problema}, \\item in enumerate, oppure numerazione tipo "1.", "Esercizio 1")
- Una sezione SOLUZIONI in fondo (ambienti \\begin{solution}, \\begin{soluzione}, \\begin{svolgimento}, oppure testo "Soluzione" / "Sol.") — abbinala all'esercizio corrispondente per numero

Per ogni elemento estratto:
- topic_id: uno tra ${topicIds.join(", ")}
- difficulty: 0 (esempio guidato), 1 (facile), 2 (medio), 3 (difficile) — usa 0 per gli esempi della sezione iniziale, stima 1/2/3 per gli esercizi numerati
- question_latex: testo completo della domanda. Testo in italiano semplice, formule in LaTeX.
- solution_latex: soluzione completa passo-passo in italiano. Per gli esempi usala dal testo; per gli esercizi abbinala dalla sezione soluzioni se presente, altrimenti costruiscila tu.
- hints: array di 2-3 suggerimenti strategici in italiano
- tags: array di 2-5 micro-argomenti in italiano es. ["integrazione per parti", "cambio di variabile", "teorema di Stokes"]

Rispondi SOLO con un array JSON valido:
[{ "topic_id":"...", "difficulty":0, "question_latex":"...", "solution_latex":"...", "hints":["..."], "tags":["..."] }]

SORGENTE LATEX:
\`\`\`latex
${cleanedLatex}
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
      // Theory: save as-is (no populate step needed)
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
            chapter_title: chapterTitle,
          }))
        );
      }
    } else {
      // Exercises: populate answers + steps + concept_tags inline before saving
      const populated = await Promise.allSettled(
        items.map(async (e: Record<string, unknown>) => {
          try {
            const pop = await populateExerciseData(
              subject,
              e.topic_id as string,
              e.question_latex as string,
              e.solution_latex as string | null,
              taxonomy,
            );
            return { ...e, ...pop };
          } catch {
            return { ...e, ...OPEN_FALLBACK, solutionSteps: OPEN_FALLBACK.solutionSteps };
          }
        })
      );

      const rows = populated.map((result, i) => {
        const e = result.status === "fulfilled" ? result.value : { ...items[i], ...OPEN_FALLBACK };
        return {
          subject,
          topic_id: e.topic_id,
          difficulty: e.difficulty,
          source: docType,
          question_latex: e.question_latex,
          solution_latex: e.solution_latex,
          hints: e.hints,
          tags: e.tags,
          answers: e.answers ?? OPEN_FALLBACK.answers,
          solution_steps: e.solutionSteps ?? OPEN_FALLBACK.solutionSteps,
          concept_tags: e.conceptTags ?? OPEN_FALLBACK.conceptTags,
          engineering,
          section,
          source_document_id: sourceDocumentId,
          chapter_title: chapterTitle,
        };
      });

      if (rows.length > 0) {
        await supabase.from("exercises").insert(rows);
      }
    }

    return NextResponse.json({ extracted: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ extracted: 0, error: msg });
  }
}
