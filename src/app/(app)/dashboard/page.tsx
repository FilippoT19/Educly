import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Flame, Target, TrendingUp, ChevronRight, Zap } from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula = [analisi1, analisi2];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: student }, { data: allStats }, { data: recentExercises }] = await Promise.all([
    supabase.from("students").select("*").eq("id", user!.id).single(),
    supabase.from("topic_stats").select("*").eq("student_id", user!.id),
    supabase
      .from("exercise_log")
      .select("*")
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stats = allStats || [];
  const totalExercises = stats.reduce((s, r) => s + r.exercises_done, 0);
  const totalCorrect = stats.reduce((s, r) => s + r.correct, 0);
  const accuracy = totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0;

  const exerciseDays = new Set(
    (recentExercises || []).map((e) => new Date(e.created_at).toDateString())
  );
  const streak = exerciseDays.size;

  const weakTopics = stats
    .filter((s) => s.exercises_done >= 2 && s.correct / s.exercises_done < 0.6)
    .sort((a, b) => (a.correct / a.exercises_done) - (b.correct / b.exercises_done))
    .slice(0, 3);

  function getTopicName(subject: string, topicId: string) {
    const c = curricula.find((c) => c.id === subject);
    return c?.topics.find((t) => t.id === topicId)?.name || topicId;
  }

  const guestEmail = process.env.GUEST_EMAIL ?? "guest@educly.app";
  const isGuest = user?.email === guestEmail;
  const AVAILABLE_COURSES = [
    { id: "analisi1", name: "Analisi 1", disabled: isGuest },
    { id: "analisi2", name: "Analisi 2", disabled: false },
  ];

  const firstName = student?.full_name?.split(" ")[0];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-10">

      {/* Header */}
      <div className="pt-2">
        <h1 className="text-[32px] font-bold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-space-grotesk)" }}>
          {firstName ? `Ciao, ${firstName}` : "Dashboard"}
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          {totalExercises === 0
            ? "Inizia il tuo primo esercizio oggi."
            : `${totalExercises} esercizi svolti · continua così.`}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Esercizi", value: totalExercises, icon: BookOpen },
          { label: "Corretti", value: totalCorrect, icon: Target },
          { label: "Accuratezza", value: totalExercises > 0 ? `${accuracy}%` : "—", icon: TrendingUp },
          { label: "Streak", value: streak > 0 ? `${streak}g` : "—", icon: Flame },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">

        {/* Courses */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
            Corsi
          </p>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {AVAILABLE_COURSES.map(({ id, name, disabled }) => {
              const courseStats = stats.filter((s) => s.subject === id);
              const done = courseStats.reduce((s, r) => s + r.exercises_done, 0);
              const correct = courseStats.reduce((s, r) => s + r.correct, 0);
              const rate = done > 0 ? Math.round((correct / done) * 100) : 0;
              const topicsStarted = courseStats.filter((s) => s.exercises_done > 0).length;
              const totalTopics = curricula.find((c) => c.id === id)?.topics.length || 0;

              if (disabled) {
                return (
                  <div key={id} className="flex items-center gap-3 px-4 py-4 opacity-30 cursor-not-allowed">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[14px]">{name}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">Non disponibile in modalità ospite</p>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={id}
                  href={`/course/${id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px]">{name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={(topicsStarted / totalTopics) * 100} className="h-[3px] flex-1" />
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {topicsStarted}/{totalTopics}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold">{rate > 0 ? `${rate}%` : "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{done} es.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Weak areas */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
            Da migliorare
          </p>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {weakTopics.length === 0 ? (
              <div className="py-10 text-center px-4">
                <Zap className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">
                  {totalExercises === 0
                    ? "Fai i primi esercizi per vedere i tuoi punti deboli."
                    : "Nessun argomento critico al momento."}
                </p>
              </div>
            ) : (
              weakTopics.map((s) => {
                const rate = Math.round((s.correct / s.exercises_done) * 100);
                return (
                  <Link
                    key={`${s.subject}-${s.topic_id}`}
                    href={`/course/${s.subject}/esercizi/${s.topic_id}`}
                    className="flex items-center gap-3 px-4 py-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">
                        {getTopicName(s.subject, s.topic_id)}
                      </p>
                      <Progress value={rate} className="h-[3px] mt-2" />
                    </div>
                    <span className="text-[13px] font-bold text-destructive shrink-0">{rate}%</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      {recentExercises && recentExercises.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
            Attività recente
          </p>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {recentExercises.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.is_correct ? "bg-green-500" : "bg-red-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium truncate">{getTopicName(e.subject, e.topic_id)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(e.created_at).toLocaleDateString("it-IT", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className={`text-[12px] font-semibold shrink-0 ${e.is_correct ? "text-green-500" : "text-muted-foreground"}`}>
                  {e.is_correct ? "Corretto" : `${e.score ?? "—"}/100`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
