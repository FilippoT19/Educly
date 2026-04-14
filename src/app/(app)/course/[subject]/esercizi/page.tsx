import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PenLine } from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = {
  analisi1: analisi1 as typeof analisi1,
  analisi2: analisi2 as unknown as typeof analisi1,
};

const DIFFICULTY_COLORS: Record<number, string> = {
  0: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  1: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  2: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  3: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};
const DIFFICULTY_LABELS: Record<number, string> = { 0: "Esempio", 1: "Facile", 2: "Medio", 3: "Difficile" };
const EXAM_COLOR = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

interface PageProps {
  params: Promise<{ subject: string }>;
}

export default async function EserciziPage({ params }: PageProps) {
  const { subject } = await params;
  const curriculum = curricula[subject];
  if (!curriculum) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, topic_id, difficulty, source")
    .eq("subject", subject);

  const allExercises = exercises || [];
  const totalCount = allExercises.length;

  // Count per macro category
  const macroCategories = curriculum.macroCategories ?? [];
  const macroCounts = macroCategories.map((cat) => {
    const catExs = allExercises.filter((e) => cat.topicIds.includes(e.topic_id));
    const byDiff: Record<string, number> = {};
    for (const ex of catExs) {
      const key = ex.source === "tema_passato" ? "exam" : String(ex.difficulty);
      byDiff[key] = (byDiff[key] || 0) + 1;
    }
    return { ...cat, total: catExs.length, byDiff };
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="pt-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/course/${subject}`} className="hover:text-foreground transition-colors">
            {curriculum.shortName}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Esercizi</span>
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">Esercizi</h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          {totalCount} esercizi disponibili · {curriculum.name}
        </p>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <PenLine className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nessun esercizio caricato ancora.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {macroCounts.map((cat) => (
            <Link
              key={cat.id}
              href={`/course/${subject}/esercizi/${cat.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 hover:border-primary/30 transition-all group"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[14px] font-medium">{cat.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {([1, 2, 3] as const).map((d) =>
                    (cat.byDiff[String(d)] || 0) > 0 ? (
                      <span key={d} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${DIFFICULTY_COLORS[d]}`}>
                        {cat.byDiff[String(d)]} {DIFFICULTY_LABELS[d]}
                      </span>
                    ) : null
                  )}
                  {(cat.byDiff["exam"] || 0) > 0 && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${EXAM_COLOR}`}>
                      {cat.byDiff["exam"]} Tema d&apos;esame
                    </span>
                  )}
                  {cat.total === 0 && (
                    <span className="text-[12px] text-muted-foreground">Nessun esercizio</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cat.total > 0 && <span className="text-sm font-semibold text-muted-foreground">{cat.total}</span>}
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
