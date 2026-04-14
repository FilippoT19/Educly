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
  type: "exact" | "self_check" | "choice";
  value?: string;
  options?: string[];
}

// Shorthand helpers
const yn = (label: string, value: "si" | "no"): Answer =>
  ({ label, type: "choice", value, options: ["si", "no"] });

const choose = (label: string, value: string, options: string[]): Answer =>
  ({ label, type: "choice", value, options });

const exact = (label: string, value: string): Answer =>
  ({ label, type: "exact", value });

const selfCheck = (label: string): Answer =>
  ({ label, type: "self_check" });

interface ExerciseSeed {
  exercise_number: string;
  answers: Answer[];
}

const OAC = ["aperto", "chiuso", "né aperto né chiuso"]; // open/closed/neither options

// ─────────────────────────────────────────────────────────────────────────────
// FILE 1 — 01 esercizi curve.md
// ─────────────────────────────────────────────────────────────────────────────

const curveAnswers: ExerciseSeed[] = [
  {
    // γ: cos t+t sin t, sin t−t cos t, −π≤t≤π
    // Chiusa: no; modulo=|t|; non regolare
    exercise_number: "01_esercizi_curve_1",
    answers: [
      yn("La curva è chiusa?", "no"),
      exact("Modulo del vettore tangente |γ'(t)|", "|t|"),
      yn("La curva è regolare?", "no"),
    ],
  },
  {
    // ρ=sin²(θ/2), θ∈[0,2π]
    // Chiusa: sì; |γ'(θ)|=|sin(θ/2)|; non regolare
    exercise_number: "01_esercizi_curve_2",
    answers: [
      yn("La curva è chiusa?", "si"),
      exact("Modulo |γ'(θ)|", "|sin(θ/2)|"),
      yn("La curva è regolare?", "no"),
    ],
  },
  {
    // r(t)=t²i+t³j, −1≤t≤1 → L=(2/27)(13√13−8)
    exercise_number: "01_esercizi_curve_3",
    answers: [exact("Lunghezza L", "\\frac{2(13\\sqrt{13}-8)}{27}")],
  },
  {
    // y=log x, 1≤x≤√3 → espressione complessa, self-check
    exercise_number: "01_esercizi_curve_4",
    answers: [selfCheck("Lunghezza L")],
  },
  {
    // (cos t,−sin t,log(3 sin t)), π/3≤t≤π/2 → L=(log3)/2
    exercise_number: "01_esercizi_curve_5",
    answers: [exact("Lunghezza L", "\\frac{\\log3}{2}")],
  },
  {
    // y=e^x, 0≤x≤1 → espressione complessa, self-check
    exercise_number: "01_esercizi_curve_6",
    answers: [selfCheck("Lunghezza L")],
  },
  {
    // ρ=e^{−θ}, 0≤θ≤2π → L=√2(1−e^{−2π})
    exercise_number: "01_esercizi_curve_7",
    answers: [exact("Lunghezza L", "\\sqrt{2}(1-e^{-2\\pi})")],
  },
  {
    // Retta tangente a (2sin t,−3cos t,4t) in t=0 → P=(0,−3,0), tang=(2,0,4)
    exercise_number: "01_esercizi_curve_8",
    answers: [
      exact("Punto P (x,y,z)", "(0,-3,0)"),
      exact("Vettore tangente (a,b,c)", "(2,0,4)"),
    ],
  },
  {
    // Stessa curva es.1, −π≤t≤π → L=π²
    exercise_number: "01_esercizi_curve_9",
    answers: [exact("Lunghezza L", "\\pi^2")],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FILE 2 — 02 esercizi funzioni 2var.md
// ─────────────────────────────────────────────────────────────────────────────

const funzioniAnswers: ExerciseSeed[] = [
  {
    // 1): 5 funzioni → classificazione dominio
    // 1)aperto,illimitato,non connesso  2)né,limitato,non connesso
    // 3)né,limitato,connesso  4)né,illimitato,non connesso  5)chiuso,limitato,connesso
    exercise_number: "02_esercizi_funzioni_2var_1",
    answers: [
      choose("1) D è…?", "aperto", OAC),
      yn("1) D è limitato?", "no"),
      yn("1) D è connesso?", "no"),
      choose("2) D è…?", "né aperto né chiuso", OAC),
      yn("2) D è limitato?", "si"),
      yn("2) D è connesso?", "no"),
      choose("3) D è…?", "né aperto né chiuso", OAC),
      yn("3) D è limitato?", "si"),
      yn("3) D è connesso?", "si"),
      choose("4) D è…?", "né aperto né chiuso", OAC),
      yn("4) D è limitato?", "no"),
      yn("4) D è connesso?", "no"),
      choose("5) D è…?", "chiuso", OAC),
      yn("5) D è limitato?", "si"),
      yn("5) D è connesso?", "si"),
    ],
  },
  {
    // 2): 4 funzioni + segno → soluzioni numerate in modo confuso, self-check
    exercise_number: "02_esercizi_funzioni_2var_2",
    answers: [selfCheck("Dominio, proprietà e segno (confronta con la soluzione)")],
  },
  {
    // 3): dominio + frontiera di 2 funzioni → descrizione testuale
    exercise_number: "02_esercizi_funzioni_2var_3",
    answers: [selfCheck("Dominio e frontiera (confronta con la soluzione)")],
  },
  {
    // 4): linee di livello di 4 funzioni → descrizione geometrica
    exercise_number: "02_esercizi_funzioni_2var_4",
    answers: [selfCheck("Linee di livello (confronta con la soluzione)")],
  },
  {
    // 5): f=√(9−2x²−6y²) → f(1,1)=1, curva di livello 2x²+6y²=8
    exercise_number: "02_esercizi_funzioni_2var_5",
    answers: [
      exact("Valore f(1,1)", "1"),
      exact("Equazione curva di livello per P=(1,1)", "2x^2+6y^2=8"),
    ],
  },
  {
    // 6): f(x,y,z)=log(x²+y²)+z → D aperto, illimitato, connesso
    exercise_number: "02_esercizi_funzioni_2var_6",
    answers: [
      choose("D è…?", "aperto", OAC),
      yn("D è limitato?", "no"),
      yn("D è connesso?", "si"),
    ],
  },
  {
    // 7): superfici di livello di 3 funzioni → descrizione geometrica
    exercise_number: "02_esercizi_funzioni_2var_7",
    answers: [selfCheck("Superfici di livello (confronta con la soluzione)")],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FILE 3 — 03 esercizi limiti 2var.md
// ─────────────────────────────────────────────────────────────────────────────

const limitiAnswers: ExerciseSeed[] = [
  {
    // 1): 8 limiti → 1)0 2)0 3)0 4)0 5)−∞ 6)1 7)0 8)0
    exercise_number: "03_esercizi_limiti_2var_1",
    answers: [
      exact("1)", "0"),
      exact("2)", "0"),
      exact("3)", "0"),
      exact("4)", "0"),
      exact("5)", "-\\infty"),
      exact("6)", "1"),
      exact("7)", "0"),
      exact("8)", "0"),
    ],
  },
  {
    // 2): dimostrazione che 4 limiti non esistono → proof, self-check
    exercise_number: "03_esercizi_limiti_2var_2",
    answers: [selfCheck("Dimostrazione (confronta il tuo ragionamento con la soluzione)")],
  },
  {
    // 3): limite di x²y/(x⁴+y²) lungo rette=0, lungo parabola=1/2 → non esiste
    exercise_number: "03_esercizi_limiti_2var_3",
    answers: [
      exact("Limite lungo le rette per l'origine", "0"),
      yn("Il limite (x,y)→(0,0) esiste?", "no"),
    ],
  },
  {
    // 4): f piecewise con f(0,0)=0 → continua ovunque incluso (0,0)
    exercise_number: "03_esercizi_limiti_2var_4",
    answers: [
      yn("f è continua in (0,0)?", "si"),
      yn("f è continua in tutto ℝ²?", "si"),
    ],
  },
  {
    // 5): f piecewise → limite in (0,0) non esiste → non continua in (0,0)
    exercise_number: "03_esercizi_limiti_2var_5",
    answers: [
      yn("Il limite in (0,0) esiste?", "no"),
      yn("f è continua in (0,0)?", "no"),
    ],
  },
  {
    // 6): f=sin(x²+y²)/(x²+y²) estendibile sì (f(0,0)=1); g=(x²-y²)/(x²+y²) no
    exercise_number: "03_esercizi_limiti_2var_6",
    answers: [
      yn("f può essere estesa con continuità?", "si"),
      exact("Valore di f(0,0) nell'estensione", "1"),
      yn("g può essere estesa con continuità?", "no"),
    ],
  },
  {
    // 7): f=(x³+y²)/(xy) → limite non esiste; non estendibile a ℝ²\{(0,0)}
    exercise_number: "03_esercizi_limiti_2var_7",
    answers: [
      yn("Il limite in (0,0) esiste?", "no"),
      yn("f è estendibile con continuità a ℝ²\\{(0,0)}?", "no"),
    ],
  },
  {
    // 8): f=e^{x²/y} → limite non esiste; non estendibile
    exercise_number: "03_esercizi_limiti_2var_8",
    answers: [
      yn("Il limite in (0,0) esiste?", "no"),
      yn("f è estendibile con continuità a ℝ²\\{(0,0)}?", "no"),
    ],
  },
  {
    // 9): f=sin(xy)/y → estendibile a tutto ℝ² (f(x,0)=x)
    exercise_number: "03_esercizi_limiti_2var_9",
    answers: [yn("f può essere estesa con continuità a tutto ℝ²?", "si")],
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
    // Check how many rows exist for this exercise_number
    const { data: rows } = await supabase
      .from("exercises")
      .select("id")
      .eq("exercise_number", seed.exercise_number);

    if (!rows || rows.length === 0) {
      console.warn(`  NOT FOUND: ${seed.exercise_number}`);
      notFound++;
      continue;
    }

    if (rows.length > 1) {
      console.warn(`  WARNING: ${seed.exercise_number} has ${rows.length} duplicates — updating all`);
    }

    // Update all matching rows (handles duplicates from re-running parse script)
    const { error } = await supabase
      .from("exercises")
      .update({ answers: seed.answers })
      .eq("exercise_number", seed.exercise_number);

    if (error) {
      console.error(`  FAILED ${seed.exercise_number}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${seed.exercise_number} (${seed.answers.length} answers, ${rows.length} rows)`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed, ${notFound} not found.`);
}

main();
