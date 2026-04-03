import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, PenLine, BookOpen } from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = { analisi1, analisi2 };

const DIFFICULTY_MAP = {
  1: { label: "Facile",      color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  2: { label: "Medio",       color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  3: { label: "Difficile",   color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  4: { label: "Tema d'esame", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
} as const;

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

  // Load all exercises for this subject
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, topic_id, difficulty, source, question_latex, tags")
    .eq("subject", subject)
    .order("difficulty", { ascending: true });

  const allExercises = exercises || [];

  // Group by topic_id
  const byTopic = new Map<string, typeof allExercises>();
  for (const ex of allExercises) {
    if (!byTopic.has(ex.topic_id)) byTopic.set(ex.topic_id, []);
    byTopic.get(ex.topic_id)!.push(ex);
  }

  // Count per difficulty (treating tema_passato as difficulty 4)
  function getDifficultyKey(ex: { difficulty: number; source: string }): 1 | 2 | 3 | 4 {
    if (ex.source === "tema_passato") return 4;
    return ex.difficulty as 1 | 2 | 3;
  }

  const totalCount = allExercises.length;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(DIFFICULTY_MAP) as [string, { label: string; color: string }][]).map(([, d]) => (
          <span key={d.label} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${d.color}`}>
            {d.label}
          </span>
        ))}
      </div>

      {/* Topics list */}
      {totalCount === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <PenLine className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nessun esercizio caricato ancora.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {curriculum.topics.map((topic) => {
            const topicExercises = byTopic.get(topic.id) || [];
            if (topicExercises.length === 0) return null;

            // Count by difficulty
            const counts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
            for (const ex of topicExercises) counts[getDifficultyKey(ex)]++;

            return (
              <Link
                key={topic.id}
                href={`/course/${subject}/esercizi/${topic.id}`}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 hover:border-primary/30 transition-all group"
              >
                {/* Topic number */}
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0">
                  {topic.order}
                </span>

                {/* Topic info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-[14px] font-medium">{topic.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([1, 2, 3, 4] as const).map((d) =>
                      counts[d] > 0 ? (
                        <span
                          key={d}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${DIFFICULTY_MAP[d].color}`}
                        >
                          {counts[d]} {DIFFICULTY_MAP[d].label}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>

                {/* Total count + arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-muted-foreground">{topicExercises.length}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </div>
              </Link>
            );
          })}

          {/* Topics with no exercises yet */}
          {curriculum.topics
            .filter((t) => !byTopic.has(t.id) || byTopic.get(t.id)!.length === 0)
            .map((topic) => (
              <div
                key={topic.id}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card opacity-40 cursor-not-allowed"
              >
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0">
                  {topic.order}
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-medium">{topic.name}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Nessun esercizio</p>
                </div>
                <BookOpen className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
