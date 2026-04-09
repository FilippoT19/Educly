import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const isGuest = user?.email === process.env.GUEST_EMAIL;
  const AVAILABLE_COURSES = [
    { id: "analisi1", name: "Analisi 1", disabled: isGuest },
    { id: "analisi2", name: "Analisi 2", disabled: false },
  ];

  const firstName = student?.full_name?.split(" ")[0];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div className="pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          {firstName ? `Ciao, ${firstName}` : "Dashboard"}
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          {totalExercises === 0
            ? "Inizia il tuo primo esercizio oggi."
            : `${totalExercises} esercizi svolti. Continua così.`}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Esercizi", value: totalExercises, icon: BookOpen },
          { label: "Corretti",  value: totalCorrect,   icon: Target },
          { label: "Accuratezza", value: totalExercises > 0 ? `${accuracy}%` : "—", icon: TrendingUp },
          { label: "Streak",   value: streak > 0 ? `${streak}g` : "—", icon: Flame },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <Icon className="h-4 w-4 text-muted-foreground mb-2" />
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">

        {/* Courses */}
        <div>
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            I tuoi corsi
          </h2>
          <Card>
            <CardContent className="py-0 divide-y divide-border">
              {AVAILABLE_COURSES.map(({ id, name, disabled }) => {
                const courseStats = stats.filter((s) => s.subject === id);
                const done = courseStats.reduce((s, r) => s + r.exercises_done, 0);
                const correct = courseStats.reduce((s, r) => s + r.correct, 0);
                const rate = done > 0 ? Math.round((correct / done) * 100) : 0;
                const topicsStarted = courseStats.filter((s) => s.exercises_done > 0).length;
                const totalTopics = curricula.find((c) => c.id === id)?.topics.length || 0;

                if (disabled) {
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 py-3.5 -mx-4 px-4 opacity-40 cursor-not-allowed first:rounded-t-xl last:rounded-b-xl"
                    >
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
                    className="flex items-center gap-3 py-3.5 hover:bg-muted/40 transition-colors -mx-4 px-4 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[14px]">{name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Progress value={(topicsStarted / totalTopics) * 100} className="h-1 flex-1" />
                        <span className="text-[12px] text-muted-foreground shrink-0">
                          {topicsStarted}/{totalTopics}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-medium">{rate > 0 ? `${rate}%` : "—"}</p>
                      <p className="text-[12px] text-muted-foreground">{done} es.</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Weak areas */}
        <div>
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Da migliorare
          </h2>
          <Card>
            <CardContent className="py-0 divide-y divide-border">
              {weakTopics.length === 0 ? (
                <div className="py-8 text-center">
                  <Zap className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
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
                      className="flex items-center gap-3 py-3.5 hover:bg-muted/40 transition-colors -mx-4 px-4 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium truncate">
                          {getTopicName(s.subject, s.topic_id)}
                        </p>
                        <Progress value={rate} className="h-1 mt-1.5" />
                      </div>
                      <Badge variant="destructive" className="text-[12px] shrink-0">{rate}%</Badge>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent activity */}
      {recentExercises && recentExercises.length > 0 && (
        <div>
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Attività recente
          </h2>
          <Card>
            <CardContent className="py-0 divide-y divide-border">
              {recentExercises.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-3 first:pt-3.5 last:pb-3.5">
                  <div
                    className={`w-[6px] h-[6px] rounded-full shrink-0 ${e.is_correct ? "bg-green-500" : "bg-red-400"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] truncate">{getTopicName(e.subject, e.topic_id)}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("it-IT", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className={`text-[12px] font-medium shrink-0 ${e.is_correct ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {e.is_correct ? "Corretto" : `${e.score ?? "—"}/100`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
