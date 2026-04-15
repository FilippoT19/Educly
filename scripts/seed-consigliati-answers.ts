/**
 * seed-consigliati-answers.ts
 *
 * Populates the `answers` array for all professor-curated exercises.
 * - type "exact"      → compared automatically with normalizeAnswer()
 * - type "self_check" → student sees solution_latex and self-reports yes/no
 * - type "choice"     → clickable option buttons
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

const sc = (label: string): Answer =>
  ({ label, type: "self_check" });

interface ExerciseSeed {
  exercise_number: string;
  answers: Answer[];
}

const OAC = ["aperto", "chiuso", "né aperto né chiuso"];

// ─────────────────────────────────────────────────────────────────────────────
// FILE 1 — 01 esercizi curve.md
// ─────────────────────────────────────────────────────────────────────────────

const curveAnswers: ExerciseSeed[] = [
  {
    // γ: cos t+t sin t, sin t−t cos t, −π≤t≤π
    // Chiusa: no; γ'(t)=(t cos t, t sin t); |γ'(t)|=|t|; non regolare in (1,0)
    exercise_number: "01_esercizi_curve_1",
    answers: [
      yn("La curva è chiusa?", "no"),
      sc("Vettore tangente γ'(t)"),          // (t cos t, t sin t) — self_check
      exact("Modulo |γ'(t)|", "|t|"),
      yn("La curva è regolare?", "no"),
    ],
  },
  {
    // ρ=sin²(θ/2), θ∈[0,2π]
    // Eq. parametriche: self_check; chiusa: sì; tangente: self_check; |γ'|=|sin(θ/2)|; non regolare
    exercise_number: "01_esercizi_curve_2",
    answers: [
      sc("Equazioni parametriche di γ"),
      yn("La curva è chiusa?", "si"),
      sc("Vettore tangente γ'(θ)"),
      exact("Modulo |γ'(θ)|", "|\\sin(\\theta/2)|"),
      yn("La curva è regolare?", "no"),
    ],
  },
  {
    // r(t)=t²i+t³j, −1≤t≤1 → L=(2/27)(13√13−8)
    exercise_number: "01_esercizi_curve_3",
    answers: [exact("Lunghezza L", "\\frac{2(13\\sqrt{13}-8)}{27}")],
  },
  {
    // y=log x, 1≤x≤√3 → espressione complessa
    exercise_number: "01_esercizi_curve_4",
    answers: [sc("Lunghezza L (calcola l'integrale e verifica con la soluzione)")],
  },
  {
    // (cos t,−sin t,log(3 sin t)), π/3≤t≤π/2 → L=(log 3)/2
    exercise_number: "01_esercizi_curve_5",
    answers: [exact("Lunghezza L", "\\frac{\\log 3}{2}")],
  },
  {
    // y=e^x, 0≤x≤1 → espressione complessa
    exercise_number: "01_esercizi_curve_6",
    answers: [sc("Lunghezza L (calcola l'integrale e verifica con la soluzione)")],
  },
  {
    // ρ=e^{−θ}, 0≤θ≤2π → L=√2(1−e^{−2π})
    exercise_number: "01_esercizi_curve_7",
    answers: [exact("Lunghezza L", "\\sqrt{2}(1-e^{-2\\pi})")],
  },
  {
    // Retta tangente a (2sin t,−3cos t,4t) in t=0
    // P=(0,−3,0), vettore tangente=(2,0,4), equazioni retta: self_check
    exercise_number: "01_esercizi_curve_8",
    answers: [
      exact("Punto P (x, y, z)", "(0,-3,0)"),
      exact("Vettore tangente (a, b, c)", "(2,0,4)"),
      sc("Equazioni della retta tangente"),
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
    // 2): 4 funzioni — per ognuna: aperto/chiuso/né, limitato, connesso (segno: self_check incluso)
    // 1)chiuso,limitato,connesso  2)aperto,illimitato,non connesso
    // 3)aperto,illimitato,non connesso  4)né aperto né chiuso,illimitato,non connesso
    exercise_number: "02_esercizi_funzioni_2var_2",
    answers: [
      choose("1) D è…?", "chiuso", OAC),
      yn("1) D è limitato?", "si"),
      yn("1) D è connesso?", "si"),
      choose("2) D è…?", "aperto", OAC),
      yn("2) D è limitato?", "no"),
      yn("2) D è connesso?", "no"),
      choose("3) D è…?", "aperto", OAC),
      yn("3) D è limitato?", "no"),
      yn("3) D è connesso?", "no"),
      choose("4) D è…?", "né aperto né chiuso", OAC),
      yn("4) D è limitato?", "no"),
      yn("4) D è connesso?", "no"),
    ],
  },
  {
    // 3): dominio + frontiera di 2 funzioni — 2 risposte per funzione = 4 totali
    exercise_number: "02_esercizi_funzioni_2var_3",
    answers: [
      sc("1) Dominio D di f"),
      sc("1) Frontiera di D"),
      sc("2) Dominio D di f"),
      sc("2) Frontiera di D"),
    ],
  },
  {
    // 4): linee di livello di 4 funzioni — 1 per funzione = 4 totali
    exercise_number: "02_esercizi_funzioni_2var_4",
    answers: [
      sc("1) Linee di livello di f(x,y)=1−x²−y²"),
      sc("2) Linee di livello di f(x,y)=xy"),
      sc("3) Linee di livello di f(x,y)=e^{−x²−y²}"),
      sc("4) Linee di livello di f(x,y)=1/(x+y)"),
    ],
  },
  {
    // 5): f=√(9−2x²−6y²) → f(1,1)=1; curva di livello 2x²+6y²=8
    exercise_number: "02_esercizi_funzioni_2var_5",
    answers: [
      exact("Valore f(1, 1)", "1"),
      exact("Equazione della curva di livello per P=(1,1)", "2x^2+6y^2=8"),
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
    // 7): superfici di livello di 3 funzioni — 1 per funzione = 3 totali
    exercise_number: "02_esercizi_funzioni_2var_7",
    answers: [
      sc("1) Superfici di livello di f(x,y,z)=x+3y+5z"),
      sc("2) Superfici di livello di f(x,y,z)=x²+3y²+5z²"),
      sc("3) Superfici di livello di f(x,y,z)=1/√(x²+y²+z²)"),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FILE 3 — 03 esercizi limiti 2var.md
// ─────────────────────────────────────────────────────────────────────────────

const limitiAnswers: ExerciseSeed[] = [
  {
    // 1): 8 limiti → 0,0,0,0,−∞,1,0,0
    exercise_number: "03_esercizi_limiti_2var_1",
    answers: [
      exact("1) Limite", "0"),
      exact("2) Limite", "0"),
      exact("3) Limite", "0"),
      exact("4) Limite", "0"),
      exact("5) Limite", "-\\infty"),
      exact("6) Limite", "1"),
      exact("7) Limite", "0"),
      exact("8) Limite", "0"),
    ],
  },
  {
    // 2): dimostrare che 4 limiti non esistono — 1 dimostrazione per limite = 4 totali
    exercise_number: "03_esercizi_limiti_2var_2",
    answers: [
      sc("1) Dimostrazione: lim xy/(x²+y²) non esiste"),
      sc("2) Dimostrazione: lim (x²+y²)/x non esiste"),
      sc("3) Dimostrazione: lim log(x+y)/x per (x,y)→(0,1) non esiste"),
      sc("4) Dimostrazione: lim x·e^{x/y} non esiste"),
    ],
  },
  {
    // 3): limite di x²y/(x⁴+y²) lungo rette=0, lungo parabola=1/2 → non esiste
    exercise_number: "03_esercizi_limiti_2var_3",
    answers: [
      exact("Limite lungo le rette per l'origine", "0"),
      exact("Limite lungo la parabola y=x²", "\\frac{1}{2}"),
      yn("Il limite per (x,y)→(0,0) esiste?", "no"),
    ],
  },
  {
    // 4): f piecewise con f(0,0)=0 → continua ovunque
    exercise_number: "03_esercizi_limiti_2var_4",
    answers: [
      yn("f è continua in (0,0)?", "si"),
      yn("f è continua in tutto ℝ²?", "si"),
    ],
  },
  {
    // 5): f piecewise → limite non esiste → non continua in (0,0)
    exercise_number: "03_esercizi_limiti_2var_5",
    answers: [
      yn("Il limite in (0,0) esiste?", "no"),
      yn("f è continua in (0,0)?", "no"),
    ],
  },
  {
    // 6): f=sin(x²+y²)/(x²+y²) estendibile sì; g=(x²-y²)/(x²+y²) no
    exercise_number: "03_esercizi_limiti_2var_6",
    answers: [
      yn("f può essere estesa con continuità in (0,0)?", "si"),
      exact("Valore di f(0,0) nell'estensione", "1"),
      yn("g può essere estesa con continuità in (0,0)?", "no"),
    ],
  },
  {
    // 7): f=(x³+y²)/(xy) — a) dominio D; b) limite non esiste; c) non estendibile
    exercise_number: "03_esercizi_limiti_2var_7",
    answers: [
      sc("a) Dominio D di f"),
      yn("b) Il limite per (x,y)→(0,0) esiste?", "no"),
      yn("c) f è estendibile con continuità a ℝ²\\{(0,0)}?", "no"),
    ],
  },
  {
    // 8): f=e^{x²/y} — a) dominio D; b) limite non esiste; c) non estendibile
    exercise_number: "03_esercizi_limiti_2var_8",
    answers: [
      sc("a) Dominio D di f"),
      yn("b) Il limite per (x,y)→(0,0) esiste?", "no"),
      yn("c) f è estendibile con continuità a ℝ²\\{(0,0)}?", "no"),
    ],
  },
  {
    // 9): f=sin(xy)/y — a) dominio D; b) estendibile a tutto ℝ² (f(x,0)=x)
    exercise_number: "03_esercizi_limiti_2var_9",
    answers: [
      sc("a) Dominio D di f"),
      yn("b) f può essere estesa con continuità a tutto ℝ²?", "si"),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FILE 4 — 04 esercizi calcolo diff1.md
// ─────────────────────────────────────────────────────────────────────────────

const calcoloDiffAnswers: ExerciseSeed[] = [
  {
    exercise_number: "04_esercizi_calcolo_diff1_1",
    answers: [
      exact("a) ∂f/∂x(0,1)", "0"),
      exact("a) ∂f/∂y(0,1)", "0"),
      yn("b) Vale la formula del gradiente in (0,1)?", "no"),
      yn("b) f è differenziabile in (0,1)?", "no"),
      exact("c) D_v f(0,1) con v lungo y=√3x", "\\frac{\\sqrt[6]{3}}{2}"),
      sc("d) D_v f(0,1) con v lungo y=2x (versore e calcolo)"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_2",
    answers: [
      exact("∂f/∂x(0,0)", "0"),
      exact("∂f/∂y(0,0)", "0"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_3",
    answers: [
      yn("∂f/∂x(0,3) esiste?", "no"),
      exact("∂f/∂y(0,3)", "0"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_4",
    answers: [
      yn("f è continua in (0,0)?", "no"),
      sc("Derivate direzionali D_v f(0,0) in ogni direzione (formula e dimostrazione)"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_5",
    answers: [
      sc("a) Descrivi il grafico di f"),
      yn("b) ∂f/∂x(0,0) esiste?", "no"),
      yn("b) ∂f/∂y(0,0) esiste?", "no"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_6",
    answers: [
      sc("a) Descrivi il grafico di f"),
      sc("b) Dimostrazione: f differenziabile in (1,1) con la definizione"),
      exact("c) Equazione piano tangente in (1,1,f(1,1))", "z=2x+2y-2"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_7",
    answers: [
      sc("a) Dominio D di f"),
      sc("b) Derivate parziali di f (dove esistono)"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_8",
    answers: [
      sc("a) Dominio D di f"),
      sc("b) Derivate parziali di f (dove esistono)"),
      yn("c) f è differenziabile in (0,0)?", "si"),
      sc("d) Dove è differenziabile f?"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_9",
    answers: [
      sc("a) Derivate parziali di f in (0,0) e nel generico punto"),
      sc("b) Derivate direzionali D_v f(0,0)"),
      yn("c) Vale la formula del gradiente in (0,0)?", "no"),
      sc("d) Dimostrazione: f non è differenziabile in (0,0)"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_10",
    answers: [
      yn("f è continua in (0,0)?", "si"),
      yn("f è derivabile (derivate parziali esistono) in (0,0)?", "si"),
      yn("f è differenziabile in (0,0)?", "no"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_11",
    answers: [
      sc("D_v f(1,1) nella direzione generica v=(cosθ, sinθ)"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_12",
    answers: [
      yn("a) f è differenziabile in (0,-1)?", "si"),
      sc("a) ∇f(0,-1) e formula D_v f(0,-1)"),
      sc("b) Direzione massima crescita e direzione con D_v f=0"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_13",
    answers: [
      sc("Equazione piano tangente in (1,π)"),
      exact("D_v f(1,π) con v=(3/5, 4/5)", "-\\frac{4e}{5}"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_14",
    answers: [
      sc("a) ∇f(0,0), versore massima e minima crescita"),
      sc("b) Verifica ortogonalità gradiente alla curva di livello"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_15",
    answers: [
      exact("Punto P dove il piano tangente è parallelo al piano xy", "(1,0,1)"),
      exact("Equazione del piano tangente in P", "z=1"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_16",
    answers: [
      sc("Direzione v tale che D_v f(1,1)=0"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_17",
    answers: [
      sc("Direzione v tale che D_v f(0,-1)=1"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_18",
    answers: [
      sc("a) ∇f(1,1)"),
      exact("b) Coefficiente angolare retta tangente alla curva di livello in P", "-4"),
      sc("c) Verifica: gradiente perpendicolare alla curva di livello in P"),
    ],
  },
  {
    exercise_number: "04_esercizi_calcolo_diff1_19",
    answers: [
      sc("a) Equazione piano tangente in (1,2,2/e²)"),
      exact("b) Equazione retta tangente alla curva di livello in P=(1,2)", "y=-8x+10"),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

const ALL_SEEDS = [...curveAnswers, ...funzioniAnswers, ...limitiAnswers, ...calcoloDiffAnswers];

async function main() {
  console.log(`\nSeeding answers for ${ALL_SEEDS.length} exercises…\n`);

  if (DRY_RUN) {
    for (const s of ALL_SEEDS) {
      console.log(`  ${s.exercise_number}  (${s.answers.length} risposte)`);
      for (const a of s.answers) {
        const val =
          a.type === "self_check" ? "(self_check)" :
          a.type === "choice" ? `[${a.options?.join(" / ")}] → "${a.value}"` :
          `"${a.value}"`;
        console.log(`    [${a.type}] ${a.label}: ${val}`);
      }
      console.log();
    }
    console.log("[dry-run] Nessun upload effettuato.");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let ok = 0, fail = 0, notFound = 0;

  for (const seed of ALL_SEEDS) {
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
      console.warn(`  WARNING: ${seed.exercise_number} ha ${rows.length} duplicati — aggiorno tutti`);
    }

    const { error } = await supabase
      .from("exercises")
      .update({ answers: seed.answers })
      .eq("exercise_number", seed.exercise_number);

    if (error) {
      console.error(`  FAILED ${seed.exercise_number}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${seed.exercise_number} (${seed.answers.length} risposte, ${rows.length} rows)`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} aggiornati, ${fail} falliti, ${notFound} non trovati.`);
}

main();
