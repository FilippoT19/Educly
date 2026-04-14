import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Zap, ChevronRight, CheckCircle, XCircle, Circle } from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = {
  analisi1,
  analisi2: analisi2 as unknown as typeof analisi1,
};

const DIFFICULTY_LABELS = ["Esempio", "Facile", "Medio", "Difficile"];
const DIFFICULTY_COLORS = ["text-blue-400", "text-green-400", "text-yellow-400", "text-red-400"];

interface PageProps {
  params: Promise<{ subject: string; topicId: string }>;
}

export default async function TopicPage({ params }: PageProps) {
  const { subject, topicId } = await params;
  const curriculum = curricula[subject];
  if (!curriculum) notFound();

  const topic = curriculum.topics.find((t) => t.id === topicId);
  if (!topic) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Topic stats
  const { data: stats } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user!.id)
    .eq("subject", subject)
    .eq("topic_id", topicId)
    .single();

  const done = stats?.exercises_done ?? 0;
  const correct = stats?.correct ?? 0;
  const rate = done > 0 ? Math.round((correct / done) * 100) : null;

  // All exercises for this topic (priority=1 only)
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, question_latex, difficulty, exercise_number, chapter_title, source_year, source")
    .eq("subject", subject)
    .eq("topic_id", topicId)
    .eq("priority", 1)
    .order("difficulty", { ascending: true })
    .order("exercise_number", { ascending: true });

  // Which ones has the student already attempted
  const { data: attempts } = await supabase
    .from("exercise_attempts")
    .select("exercise_id, is_correct")
    .eq("student_id", user!.id)
    .in("exercise_id", (exercises || []).map((e) => e.id));

  const attemptMap = new Map<string, boolean>();
  for (const a of attempts || []) {
    // Keep the latest correct attempt if any
    if (!attemptMap.has(a.exercise_id) || a.is_correct) {
      attemptMap.set(a.exercise_id, a.is_correct);
    }
  }

  const exerciseList = exercises || [];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/course/${subject}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {curriculum.shortName}
        </Link>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Capitolo {topic.order}</p>
        <h1 className="text-xl font-bold tracking-tight mt-0.5">{topic.name}</h1>
      </div>

      {/* Stats */}
      {done > 0 && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-semibold">{done}/{exerciseList.length} esercizi · {rate}%</span>
          </div>
          <Progress value={rate ?? 0} className="h-1.5" />
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="text-green-400">{correct} corretti</span>
            <span className="text-red-400">{done - correct} sbagliati</span>
          </div>
        </div>
      )}

      {/* Inizia subito */}
      {exerciseList.length > 0 && (
        <Link
          href={`/practice/${subject}/${topicId}?back=/course/${subject}/topic/${topicId}`}
          className="flex items-center gap-4 p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors group"
        >
          <div className="p-2.5 rounded-xl bg-primary/15 shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Inizia subito</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {done === 0 ? "Esercizio consigliato per te →" : "Continua l'allenamento →"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* Exercise list */}
      {exerciseList.length > 0 && (
        <div>
          <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">
            Tutti gli esercizi
          </h2>
          <div className="space-y-2">
            {exerciseList.map((ex) => {
              const attempted = attemptMap.has(ex.id);
              const isCorrect = attemptMap.get(ex.id);
              const preview = (ex.chapter_title || ex.question_latex || "")
                .replace(/\$\$?[^$]*\$\$?/g, "…")
                .slice(0, 90);

              return (
                <Link
                  key={ex.id}
                  href={`/practice/${subject}/${topicId}?exerciseId=${ex.id}&back=/course/${subject}/topic/${topicId}`}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-primary/3 transition-all group"
                >
                  <div className="shrink-0 mt-0.5">
                    {!attempted ? (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    ) : isCorrect ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug text-foreground/80 line-clamp-2">
                      {preview || "Esercizio"}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_COLORS[ex.difficulty ?? 1]}`}>
                        {DIFFICULTY_LABELS[ex.difficulty ?? 1]}
                      </Badge>
                      {ex.source === "tema_passato" && ex.source_year && (
                        <span className="text-[10px] text-red-400 font-medium">Esame {ex.source_year}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-1 group-hover:text-muted-foreground transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {exerciseList.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nessun esercizio disponibile per questo capitolo.</p>
          <p className="text-xs mt-1">Presto ne arriveranno altri!</p>
        </div>
      )}
    </div>
  );
}
