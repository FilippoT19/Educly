import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight,
  Zap,
  BookOpen,
  GraduationCap,
  Lock,
} from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = {
  analisi1,
  analisi2: analisi2 as unknown as typeof analisi1,
};

interface PageProps {
  params: Promise<{ subject: string }>;
}

export default async function CoursePage({ params }: PageProps) {
  const { subject } = await params;
  const curriculum = curricula[subject];
  if (!curriculum) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Student stats per topic
  const { data: allStats } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user!.id)
    .eq("subject", subject);

  const statsMap = new Map((allStats || []).map((s) => [s.topic_id, s]));
  const totalExercises = (allStats || []).reduce(
    (s, r) => s + r.exercises_done,
    0
  );
  const totalCorrect = (allStats || []).reduce((s, r) => s + r.correct, 0);
  const totalWrong = totalExercises - totalCorrect;
  const accuracy =
    totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0;

  // Count available priority=1 exercises per topic
  const { data: exCounts } = await supabase
    .from("exercises")
    .select("topic_id")
    .eq("subject", subject)
    .eq("priority", 1);

  const topicExerciseCount = new Map<string, number>();
  for (const row of exCounts || []) {
    topicExerciseCount.set(
      row.topic_id,
      (topicExerciseCount.get(row.topic_id) ?? 0) + 1
    );
  }

  // Temi d'esame
  const { data: temiEsame } = await supabase
    .from("exercises")
    .select("id, question_latex, topic_id, source_year, difficulty, chapter_title")
    .eq("subject", subject)
    .eq("source", "tema_passato")
    .order("source_year", { ascending: false })
    .limit(30);

  // Determine best topic for "Inizia subito"
  const topicsWithExercises = curriculum.topics.filter((t) =>
    (topicExerciseCount.get(t.id) ?? 0) > 0
  );

  let bestTopicId: string | null = null;
  if (topicsWithExercises.length > 0) {
    // Find first topic not yet mastered (accuracy < 70% or not started)
    const notMastered = topicsWithExercises.find((t) => {
      const s = statsMap.get(t.id);
      if (!s || s.exercises_done === 0) return true;
      return s.exercises_done > 0 && s.correct / s.exercises_done < 0.7;
    });
    bestTopicId = (notMastered ?? topicsWithExercises[0]).id;
  }

  // Group temi d'esame by year
  const temiByYear = new Map<number | string, typeof temiEsame>();
  for (const t of temiEsame || []) {
    const year = t.source_year ?? "Senza anno";
    if (!temiByYear.has(year)) temiByYear.set(year, []);
    temiByYear.get(year)!.push(t);
  }

  const DIFFICULTY_LABELS = ["Esempio", "Facile", "Medio", "Difficile"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
          {subject === "analisi1" ? "Analisi 1" : "Analisi 2"} · Politecnico
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{curriculum.name}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Svolti", value: totalExercises },
          {
            label: "Corretti",
            value: totalCorrect,
            color: "text-green-500",
          },
          {
            label: "Sbagliati",
            value: totalWrong,
            color: "text-red-400",
          },
          {
            label: "% successo",
            value: totalExercises > 0 ? `${accuracy}%` : "—",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card text-center py-3 px-2"
          >
            <p className={`text-xl font-bold tracking-tight ${color ?? ""}`}>
              {value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Inizia subito CTA */}
      {bestTopicId && (
        <Link
          href={`/practice/${subject}/${bestTopicId}?back=/course/${subject}`}
          className="flex items-center gap-4 p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors group"
        >
          <div className="p-2.5 rounded-xl bg-primary/15 shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Inizia subito</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalExercises === 0
                ? "Primo esercizio consigliato per te →"
                : "Continua da dove hai lasciato →"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* Capitoli */}
      <div>
        <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">
          Capitoli
        </h2>
        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {curriculum.topics.map((topic) => {
            const stat = statsMap.get(topic.id);
            const done = stat?.exercises_done ?? 0;
            const correct = stat?.correct ?? 0;
            const rate = done > 0 ? Math.round((correct / done) * 100) : null;
            const available = topicExerciseCount.get(topic.id) ?? 0;
            const hasExercises = available > 0;

            if (!hasExercises) {
              return (
                <div
                  key={topic.id}
                  className="flex items-center gap-3 px-4 py-3.5 opacity-50"
                >
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground shrink-0">
                    {topic.order}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium">{topic.name}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 italic">
                    Prossimamente
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={topic.id}
                href={`/practice/${subject}/${topic.id}?back=/course/${subject}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group"
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    rate !== null && rate >= 70
                      ? "bg-green-500/20 text-green-400"
                      : rate !== null
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {topic.order}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[13.5px] font-medium">{topic.name}</p>
                  {done > 0 && (
                    <div className="flex items-center gap-2">
                      <Progress value={rate ?? 0} className="h-[3px] flex-1" />
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {done}/{available}
                      </span>
                    </div>
                  )}
                  {done === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {available} {available === 1 ? "esercizio" : "esercizi"} disponibili
                    </p>
                  )}
                </div>
                {rate !== null ? (
                  <Badge
                    variant={
                      rate >= 70
                        ? "default"
                        : rate >= 40
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-[11px] shrink-0"
                  >
                    {rate}%
                  </Badge>
                ) : null}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Temi d'esame */}
      {(temiEsame || []).length > 0 && (
        <div>
          <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5 flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5 text-red-400" />
            Temi d&apos;esame
          </h2>
          <div className="space-y-3">
            {Array.from(temiByYear.entries()).map(([year, exercises]) => (
              <div key={year} className="rounded-2xl border border-red-500/20 bg-red-500/3 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-500/20 bg-red-500/5">
                  <GraduationCap className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span className="text-[12px] font-semibold text-red-400">
                    Esame {year}
                  </span>
                </div>
                <div className="divide-y divide-red-500/10">
                  {(exercises || []).map((ex) => (
                    <Link
                      key={ex.id}
                      href={`/practice/${subject}/${ex.topic_id ?? curriculum.topics[0].id}?exerciseId=${ex.id}&back=/course/${subject}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-red-500/5 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-snug line-clamp-2 text-foreground/80">
                          {ex.chapter_title ?? ex.question_latex?.slice(0, 80) ?? "Esercizio"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-red-500/30 text-red-400 shrink-0"
                      >
                        {DIFFICULTY_LABELS[ex.difficulty ?? 2] ?? "Medio"}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-red-400/40 shrink-0 group-hover:text-red-400 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sezioni bloccate */}
      <div>
        <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">
          In arrivo
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { label: "Teoria", description: "Lezioni interattive con mini-quiz", icon: BookOpen },
          ].map(({ label, description, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-3.5 rounded-xl border bg-card opacity-40 cursor-not-allowed"
            >
              <div className="p-2 rounded-lg bg-muted shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-medium">{label}</p>
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
