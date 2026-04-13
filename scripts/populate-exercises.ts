/**
 * populate-exercises.ts
 *
 * Runs AI populate (answers + solution_steps + concept_tags) locally,
 * bypassing Vercel's 10-second timeout.
 *
 * Usage:
 *   npx ts-node scripts/populate-exercises.ts --subject analisi2
 *   npx ts-node scripts/populate-exercises.ts --subject analisi2 --source-document-id <uuid>
 *   npx ts-node scripts/populate-exercises.ts --subject analisi2 --limit 10
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// --- Types (mirrors src/lib/claude.ts) ---

interface SolutionStep {
  step: number;
  title: string;
  text: string;
  formula: string;
  detail: string;
  weight: number;
}

interface ExerciseAnswer {
  label: string;
  type: "exact" | "open";
  value?: string;
}

interface PopulateResult {
  answers: ExerciseAnswer[];
  solutionSteps: SolutionStep[];
  conceptTags: string[];
}

// --- Curriculum data ---

import { createRequire } from "module";
const _require = createRequire(import.meta.url);

const analisi1 = _require("../src/content/analisi1.json") as {
  topics: { id: string; name: string }[];
};
const analisi2 = _require("../src/content/analisi2.json") as {
  topics: { id: string; name: string }[];
  conceptTaxonomy?: string[];
};

const curricula: Record<string, typeof analisi1 & { conceptTaxonomy?: string[] }> = {
  analisi1,
  analisi2,
};

function getTopicName(subject: string, topicId: string): string {
  return curricula[subject]?.topics.find((t) => t.id === topicId)?.name ?? topicId;
}

function getConceptTaxonomy(subject: string): string[] {
  const c = curricula[subject] as typeof analisi2 | undefined;
  return c && "conceptTaxonomy" in c ? (c.conceptTaxonomy ?? []) : [];
}

// --- Build question/solution text (mirrors populate/route.ts) ---

type ExerciseRow = {
  question_latex: string | null;
  solution_latex: string | null;
  has_star: boolean | null;
  parts: Array<{ label: string; question_latex: string; solution_latex: string | null }> | null;
};

function buildTexts(ex: ExerciseRow): { questionText: string; solutionText: string | null } {
  const parts = ex.parts ?? [];

  if (parts.length > 0) {
    const preamble = ex.question_latex ?? "";
    const questionText = [
      preamble,
      ...parts.map((p) => `Parte ${p.label.toUpperCase()}:\n${p.question_latex}`),
    ]
      .filter(Boolean)
      .join("\n\n");

    const solutionParts = parts
      .filter((p) => p.solution_latex)
      .map((p) => `Parte ${p.label.toUpperCase()}:\n${p.solution_latex}`);

    return {
      questionText,
      solutionText: solutionParts.length > 0 ? solutionParts.join("\n\n") : null,
    };
  }

  return { questionText: ex.question_latex ?? "", solutionText: ex.solution_latex };
}

// --- JSON repair for Claude's LaTeX output ---

/** Extract the first balanced {...} block from Claude's response. */
function extractJsonBlock(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");

  let depth = 0;
  let inString = false;
  let i = start;

  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") {
        i += 2; // skip escaped char
        continue;
      }
      if (ch === '"') inString = false;
    } else {
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    i++;
  }
  throw new Error("Unbalanced JSON braces in response");
}

function parseClaudeJson(raw: string): unknown {
  const block = extractJsonBlock(raw);

  // Try parsing as-is first
  try {
    return JSON.parse(block);
  } catch {
    // Claude sometimes writes single backslashes in LaTeX (\frac instead of \\frac).
    // Fix: inside string values, double any backslash not part of a valid JSON escape.
    let out = "";
    let inString = false;
    let i = 0;
    while (i < block.length) {
      const ch = block[i];
      if (!inString) {
        out += ch;
        if (ch === '"') inString = true;
        i++;
      } else {
        if (ch === "\\") {
          const next = block[i + 1];
          if (next === undefined) {
            out += ch;
            i++;
          } else if (next === "u") {
            // \uXXXX is only valid if followed by exactly 4 hex digits
            const hex = block.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              out += ch + next + hex;
              i += 6;
            } else {
              out += "\\\\" + next;
              i += 2;
            }
          } else if ('"\\/bfnrt'.includes(next)) {
            out += ch + next;
            i += 2;
          } else {
            out += "\\\\" + next;
            i += 2;
          }
        } else if (ch === '"') {
          out += ch;
          inString = false;
          i++;
        } else {
          out += ch;
          i++;
        }
      }
    }
    return JSON.parse(out);
  }
}

// --- Claude call (mirrors populateExerciseData in src/lib/claude.ts) ---

async function populateExerciseData(
  subject: string,
  topicName: string,
  questionLatex: string,
  solutionLatex: string | null,
  conceptTaxonomy: string[] = [],
): Promise<PopulateResult> {
  const subjectName =
    subject === "analisi1" ? "Analisi Matematica 1" : "Analisi Matematica 2";

  const taxonomyBlock =
    conceptTaxonomy.length > 0
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
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return parseClaudeJson(jsonMatch[0]) as PopulateResult;
}

// --- CLI args ---

function parseArgs() {
  const args = process.argv.slice(2);

  function flag(name: string): string | undefined {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  const subject = flag("--subject");
  const sourceDocumentId = flag("--source-document-id");
  const limitArg = flag("--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined; // undefined = process all

  return { subject, sourceDocumentId, limit };
}

// --- Main ---

async function main() {
  const { subject, sourceDocumentId, limit } = parseArgs();

  if (!subject) {
    console.error("Usage: npx ts-node scripts/populate-exercises.ts --subject <analisi1|analisi2> [--source-document-id <uuid>] [--limit <n>]");
    process.exit(1);
  }

  const taxonomy = getConceptTaxonomy(subject);

  // Count remaining
  let countQuery = supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("subject", subject)
    .or("concept_tags.eq.{},concept_tags.is.null");

  if (sourceDocumentId) {
    countQuery = countQuery.eq("source_document_id", sourceDocumentId);
  }

  const { count: totalRemaining } = await countQuery;
  const toProcess = limit !== undefined ? Math.min(limit, totalRemaining ?? 0) : (totalRemaining ?? 0);

  console.log(`\nSubject: ${subject}`);
  if (sourceDocumentId) console.log(`Source document: ${sourceDocumentId}`);
  console.log(`Remaining (not yet populated): ${totalRemaining ?? 0}`);
  console.log(`Will process: ${toProcess}\n`);

  if (toProcess === 0) {
    console.log("Nothing to do.");
    return;
  }

  let fetchQuery = supabase
    .from("exercises")
    .select("id, subject, topic_id, exercise_number, question_latex, solution_latex, has_star, parts")
    .eq("subject", subject)
    .or("concept_tags.eq.{},concept_tags.is.null");

  if (sourceDocumentId) {
    fetchQuery = fetchQuery.eq("source_document_id", sourceDocumentId);
  }

  if (limit !== undefined) {
    fetchQuery = fetchQuery.limit(limit);
  }

  const { data: exercises, error } = await fetchQuery;

  if (error) {
    console.error("Failed to fetch exercises:", error.message);
    process.exit(1);
  }

  if (!exercises || exercises.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const ex of exercises) {
    const label = ex.exercise_number ?? ex.id;
    const topicName = getTopicName(ex.subject, ex.topic_id);
    const { questionText, solutionText } = buildTexts(ex);

    process.stdout.write(`  [${processed + 1}/${exercises.length}] ${label} — `);

    try {
      const result = await populateExerciseData(
        ex.subject,
        topicName,
        questionText,
        solutionText,
        taxonomy,
      );

      await supabase
        .from("exercises")
        .update({
          answers: result.answers,
          solution_steps: result.solutionSteps,
          concept_tags: result.conceptTags,
        })
        .eq("id", ex.id);

      console.log(`ok (tags: ${result.conceptTags.join(", ")})`);
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);

      await supabase
        .from("exercises")
        .update({
          answers: [{ label: "Soluzione", type: "open" }],
          solution_steps: [],
          concept_tags: ["da_rivedere"],
        })
        .eq("id", ex.id);

      failed++;
    }

    processed++;
  }

  console.log(`\n✓ Done: ${succeeded} succeeded, ${failed} failed`);
  if (failed > 0) {
    console.log(`  Failed exercises were tagged "da_rivedere" and won't be re-processed automatically.`);
  }
}

main();
