/**
 * seed-consigliati-answers.ts
 *
 * Populates the `answers` array for all professor-curated exercises.
 * - type "exact"      → compared automatically with normalizeAnswer()
 * - type "self_check" → student sees solution_latex and self-reports yes/no
 *
 * Usage:
 *   npx ts-node scripts/seed-consigliati-answers.ts [--dry-run]
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DRY_RUN = process.argv.includes("--dry-run");

interface Answer {
  label: string;
  type: "exact" | "self_check";
  value?: string;
}

interface ExerciseSeed {
  exercise_number: string;
  answers: Answer[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE 1 — 01 esercizi curve.md
// ─────────────────────────────────────────────────────────────────────────────
// exercise_number pattern: "01_esercizi_curve_N"

const curveAnswers: ExerciseSeed[] = [
  {
    // γ: cos t + t sin t, sin t - t cos t, -π ≤ t ≤ π
    // Chiusa: no (γ(-π)≠γ(π)), tangente=(t cos t, t sin t), modulo=|t|, non regolare
    exercise_number: "01_esercizi_curve_1",
    answers: [
      { label: "La curva è chiusa?", type: "exact", value: "no" },
      { label: "Modulo del vettore tangente |γ'(t)|", type: "exact", value: "|t|" },
      { label: "La curva è regolare?", type: "exact", value: "no" },
    ],
  },
  {
    // ρ = sin²(θ/2), θ∈[0,2π]
    // Chiusa: sì (γ(0)=γ(2π)=(0,0)), |γ'(θ)|=|sin(θ/2)|, non regolare in (0,0)
    exercise_number: "01_esercizi_curve_2",
    answers: [
      { label: "La curva è chiusa?", type: "exact", value: "si" },
      { label: "Modulo del vettore tangente |γ'(θ)|", type: "exact", value: "|sin(θ/2)|" },
      { label: "La curva è regolare?", type: "exact", value: "no" },
    ],
  },
  {
    // r(t)=t²i+t³j, -1≤t≤1   →   L = (2/27)(13√13 - 8)
    exercise_number: "01_esercizi_curve_3",
    answers: [
      { label: "Lunghezza L", type: "exact", value: "\\frac{2(13\\sqrt{13}-8)}{27}" },
    ],
  },
  {
    // y = log x, 1≤x≤√3   →   complex expression, student self-checks
    exercise_number: "01_esercizi_curve_4",
    answers: [
      { label: "Lunghezza L", type: "self_check" },
    ],
  },
  {
    // parametric in 3D: (cos t, -sin t, log(3 sin t)), π/3≤t≤π/2   →   L = (1/2)log3
    exercise_number: "01_esercizi_curve_5",
    answers: [
      { label: "Lunghezza L", type: "exact", value: "\\frac{\\log 3}{2}" },
    ],
  },
  {
    // y = e^x, 0≤x≤1   →   complex expression, student self-checks
    exercise_number: "01_esercizi_curve_6",
    answers: [
      { label: "Lunghezza L", type: "self_check" },
    ],
  },
  {
    // ρ = e^{-θ}, 0≤θ≤2π   →   L = √2(1 - e^{-2π})
    exercise_number: "01_esercizi_curve_7",
    answers: [
      { label: "Lunghezza L", type: "exact", value: "\\sqrt{2}(1-e^{-2\\pi})" },
    ],
  },
  {
    // Retta tangente a (2sin t, -3cos t, 4t) in t=0
    // P=(0,-3,0), vettore tangente=(2,0,4)
    exercise_number: "01_esercizi_curve_8",
    answers: [
      { label: "Punto P (x,y,z)", type: "exact", value: "(0,-3,0)" },
      { label: "Vettore tangente (a,b,c)", type: "exact", value: "(2,0,4)" },
    ],
  },
  {
    // Stessa curva dell'es.1, -π≤t≤π   →   L = π²
    exercise_number: "01_esercizi_curve_9",
    answers: [
      { label: "Lunghezza L", type: "exact", value: "\\pi^2" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FILE 2 — 02 esercizi funzioni 2var.md
// ─────────────────────────────────────────────────────────────────────────────
// exercise_number pattern: "02_esercizi_funzioni_2var_N"

const funzioniAnswers: ExerciseSeed[] = [
  {
    // Ex 1: dominio di 5 funzioni → classificazione open/closed/bounded/connected
    // Solutions given for sub-parts 1)-5):
    //  1) aperto, illimitato, non connesso
    //  2) né aperto né chiuso, limitato, non connesso
    //  3) né aperto né chiuso, limitato, connesso
    //  4) né aperto né chiuso, illimitato, non connesso
    //  5) chiuso, limitato, connesso
    exercise_number: "02_esercizi_funzioni_2var_1",
    answers: [
      { label: "1) D è aperto/chiuso/né?", type: "exact", value: "aperto" },
      { label: "1) D è limitato?", type: "exact", value: "no" },
      { label: "1) D è connesso?", type: "exact", value: "no" },
      { label: "2) D è aperto/chiuso/né?", type: "exact", value: "né aperto né chiuso" },
      { label: "2) D è limitato?", type: "exact", value: "si" },
      { label: "2) D è connesso?", type: "exact", value: "no" },
      { label: "3) D è aperto/chiuso/né?", type: "exact", value: "né aperto né chiuso" },
      { label: "3) D è limitato?", type: "exact", value: "si" },
      { label: "3) D è connesso?", type: "exact", value: "si" },
      { label: "4) D è aperto/chiuso/né?", type: "exact", value: "né aperto né chiuso" },
      { label: "4) D è limitato?", type: "exact", value: "no" },
      { label: "4) D è connesso?", type: "exact", value: "no" },
      { label: "5) D è aperto/chiuso/né?", type: "exact", value: "chiuso" },
      { label: "5) D è limitato?", type: "exact", value: "si" },
      { label: "5) D è connesso?", type: "exact", value: "si" },
    ],
  },
  {
    // Ex 2: dominio di 4 funzioni + segno
    //  1) chiuso, limitato, connesso (from solution "3) D è chiuso...")
    //  Wait — solution numbering for ex 2 starts from sub-part 3:
    //  2. 3) → chiuso, limitato, connesso
    //     2) → aperto, illimitato, non connesso
    //     3) → aperto, illimitato, non connesso
    //     4) → né, illimitato, non connesso
    // Note: solution numbering is confusing (2.3), 2.2), etc.) — use self_check for safety
    exercise_number: "02_esercizi_funzioni_2var_2",
    answers: [
      { label: "1) D è aperto/chiuso/né?", type: "self_check" },
    ],
  },
  {
    // Ex 3: dominio di 2 funzioni + frontiera → complex descriptions
    exercise_number: "02_esercizi_funzioni_2var_3",
    answers: [
      { label: "Dominio e frontiera", type: "self_check" },
    ],
  },
  {
    // Ex 4: linee di livello di 4 funzioni → descriptive
    exercise_number: "02_esercizi_funzioni_2var_4",
    answers: [
      { label: "Linee di livello", type: "self_check" },
    ],
  },
  {
    // Ex 5: f=√(9-2x²-6y²)
    // Dominio: ellisse 2x²+6y²≤9
    // Linee di livello 0,1,3 e curva per P=(1,1): livello c=f(1,1)=1 → 2x²+6y²=8
    exercise_number: "02_esercizi_funzioni_2var_5",
    answers: [
      { label: "Valore f(1,1) (livello della curva per P)", type: "exact", value: "1" },
      { label: "Equazione curva di livello per P=(1,1)", type: "exact", value: "2x^2+6y^2=8" },
    ],
  },
  {
    // Ex 6: dominio f(x,y,z)=log(x²+y²)+z → (x,y)≠(0,0), aperto, illimitato, connesso
    exercise_number: "02_esercizi_funzioni_2var_6",
    answers: [
      { label: "D è aperto/chiuso/né?", type: "exact", value: "aperto" },
      { label: "D è limitato?", type: "exact", value: "no" },
      { label: "D è connesso?", type: "exact", value: "si" },
    ],
  },
  {
    // Ex 7: superfici di livello di 3 funzioni → piani, ellissoidi, sfere
    exercise_number: "02_esercizi_funzioni_2var_7",
    answers: [
      { label: "Superfici di livello", type: "self_check" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FILE 3 — 03 esercizi limiti 2var.md
// ─────────────────────────────────────────────────────────────────────────────
// exercise_number pattern: "03_esercizi_limiti_2var_N"

const limitiAnswers: ExerciseSeed[] = [
  {
    // Ex 1: 8 limits
    // 1)0  2)0  3)0  4)0  5)-∞  6)1  7)0  8)0
    exercise_number: "03_esercizi_limiti_2var_1",
    answers: [
      { label: "1)", type: "exact", value: "0" },
      { label: "2)", type: "exact", value: "0" },
      { label: "3)", type: "exact", value: "0" },
      { label: "4)", type: "exact", value: "0" },
      { label: "5)", type: "exact", value: "-\\infty" },
      { label: "6)", type: "exact", value: "1" },
      { label: "7)", type: "exact", value: "0" },
      { label: "8)", type: "exact", value: "0" },
    ],
  },
  {
    // Ex 2: dimostrare che 4 limiti non esistono → proof exercise, self_check
    exercise_number: "03_esercizi_limiti_2var_2",
    answers: [
      { label: "Dimostrazione (verifica il tuo ragionamento)", type: "self_check" },
    ],
  },
  {
    // Ex 3: limite lungo rette vs parabola → proof, self_check
    exercise_number: "03_esercizi_limiti_2var_3",
    answers: [
      { label: "Limite lungo le rette", type: "exact", value: "0" },
      { label: "Il limite (x,y)→(0,0) esiste?", type: "exact", value: "no" },
    ],
  },
  {
    // Ex 4: continuità di f piecewise con f(0,0)=0
    // Continua ovunque incluso (0,0): sì
    exercise_number: "03_esercizi_limiti_2var_4",
    answers: [
      { label: "f è continua in (0,0)?", type: "exact", value: "si" },
      { label: "f è continua in tutto ℝ²?", type: "exact", value: "si" },
    ],
  },
  {
    // Ex 5: continuità di f piecewise
    // Il limite in (0,0) non esiste → f non è continua in (0,0)
    exercise_number: "03_esercizi_limiti_2var_5",
    answers: [
      { label: "Il limite in (0,0) esiste?", type: "exact", value: "no" },
      { label: "f è continua in (0,0)?", type: "exact", value: "no" },
    ],
  },
  {
    // Ex 6: f(x,y)=sin(x²+y²)/(x²+y²), g(x,y)=(x²-y²)/(x²+y²)
    // f estendibile con continuità? sì (con f(0,0)=1)
    // g estendibile? no
    exercise_number: "03_esercizi_limiti_2var_6",
    answers: [
      { label: "f può essere estesa con continuità?", type: "exact", value: "si" },
      { label: "Valore di f(0,0) nell'estensione", type: "exact", value: "1" },
      { label: "g può essere estesa con continuità?", type: "exact", value: "no" },
    ],
  },
  {
    // Ex 7: f=(x³+y²)/(xy)
    // b) limite in (0,0): non esiste
    // c) f estendibile con continuità a ℝ²\{(0,0)}: no (non sull'asse x)
    exercise_number: "03_esercizi_limiti_2var_7",
    answers: [
      { label: "Il limite in (0,0) esiste?", type: "exact", value: "no" },
      { label: "f è estendibile con continuità a ℝ²\\{(0,0)}?", type: "exact", value: "no" },
    ],
  },
  {
    // Ex 8: f=e^{x²/y}
    // b) limite in (0,0): non esiste
    // c) estendibile a ℝ²\{(0,0)}: no (non sull'asse x)
    exercise_number: "03_esercizi_limiti_2var_8",
    answers: [
      { label: "Il limite in (0,0) esiste?", type: "exact", value: "no" },
      { label: "f è estendibile con continuità a ℝ²\\{(0,0)}?", type: "exact", value: "no" },
    ],
  },
  {
    // Ex 9: f=sin(xy)/y
    // b) estendibile con continuità a tutto ℝ²: sì (ponendo f(x,0)=x)
    exercise_number: "03_esercizi_limiti_2var_9",
    answers: [
      { label: "f può essere estesa con continuità a tutto ℝ²?", type: "exact", value: "si" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

const ALL_SEEDS = [...curveAnswers, ...funzioniAnswers, ...limitiAnswers];

async function main() {
  console.log(`\nSeeding answers for ${ALL_SEEDS.length} exercises…`);

  if (DRY_RUN) {
    for (const s of ALL_SEEDS) {
      console.log(`\n  ${s.exercise_number}`);
      for (const a of s.answers) {
        const val = a.type === "self_check" ? "(self_check)" : `"${a.value}"`;
        console.log(`    [${a.type}] ${a.label}: ${val}`);
      }
    }
    console.log("\n[dry-run] Skipping upload.");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let ok = 0, fail = 0, notFound = 0;

  for (const seed of ALL_SEEDS) {
    // Look up the exercise by exercise_number
    const { data: ex } = await supabase
      .from("exercises")
      .select("id, answers")
      .eq("exercise_number", seed.exercise_number)
      .single();

    if (!ex) {
      console.warn(`  NOT FOUND: ${seed.exercise_number}`);
      notFound++;
      continue;
    }

    const { error } = await supabase
      .from("exercises")
      .update({ answers: seed.answers })
      .eq("id", ex.id);

    if (error) {
      console.error(`  FAILED ${seed.exercise_number}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${seed.exercise_number} (${seed.answers.length} answers)`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed, ${notFound} not found.`);
}

main();
