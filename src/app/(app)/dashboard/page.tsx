import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Compute streak
  const exerciseDays = new Set(
    (recentExercises || []).map((e) => new Date(e.created_at).toDateString())
  );
  const streak = exerciseDays.size; // simplified — days with at least 1 exercise

  // Weak topics across all subjects
  const weakTopics = stats
    .filter((s) => s.exercises_done >= 2 && s.correct / s.exercises_done < 0.6)
    .sort((a, b) => (a.correct / a.exercises_done) - (b.correct / b.exercises_done))
    .slice(0, 3);

  function getTopicName(subject: string, topicId: string) {
    const c = curricula.find((c) => c.id === subject);
    return c?.topics.find((t) => t.id === topicId)?.name || topicId;
  }

  const AVAILABLE_COURSES = [
    { id: "analisi1", name: "Analisi 1", color: "bg-blue-500" },
    { id: "analisi2", name: "Analisi 2", color: "bg-indigo-500" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          Ciao{student ? `, ${student.full_name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-muted-foreground mt-0.5">
          {totalExercises === 0
            ? "Inizia il tuo primo esercizio oggi."
            : `Hai fatto ${totalExercises} esercizi finora. Continua così!`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Esercizi", value: totalExercises, icon: BookOpen, color: "text-blue-600" },
          { label: "Corretti", value: totalCorrect, icon: Target, color: "text-green-600" },
          { label: "Accuratezza", value: `${accuracy}%`, icon: TrendingUp, color: "text-violet-600" },
          { label: "Streak", value: `${streak}g`, icon: Flame, color: "text-orange-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Available courses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">I tuoi corsi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {AVAILABLE_COURSES.map(({ id, name, color }) => {
              const courseStats = stats.filter((s) => s.subject === id);
              const done = courseStats.reduce((s, r) => s + r.exercises_done, 0);
              const correct = courseStats.reduce((s, r) => s + r.correct, 0);
              const rate = done > 0 ? Math.round((correct / done) * 100) : 0;
              const topicsStarted = courseStats.filter((s) => s.exercises_done > 0).length;
              const totalTopics = curricula.find((c) => c.id === id)?.topics.length || 0;

              return (
                <Link
                  key={id}
                  href={`/course/${id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                >
                  <div className={`w-2 h-10 rounded-full ${color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={(topicsStarted / totalTopics) * 100} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground shrink-0">
                        {topicsStarted}/{totalTopics} argomenti
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{rate > 0 ? `${rate}%` : "—"}</p>
                    <p className="text-xs text-muted-foreground">{done} esercizi</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Weak areas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Da migliorare
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weakTopics.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  {totalExercises === 0
                    ? "Fai i primi esercizi per vedere i tuoi punti deboli."
                    : "Ottimo! Nessun argomento critico al momento."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {weakTopics.map((s) => {
                  const rate = Math.round((s.correct / s.exercises_done) * 100);
                  return (
                    <Link
                      key={`${s.subject}-${s.topic_id}`}
                      href={`/course/${s.subject}/esercizi/${s.topic_id}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getTopicName(s.subject, s.topic_id)}
                        </p>
                        <Progress value={rate} className="h-1.5 mt-1" />
                      </div>
                      <Badge variant="destructive" className="text-xs shrink-0">{rate}%</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      {recentExercises && recentExercises.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attività recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentExercises.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${e.is_correct ? "bg-green-500" : "bg-red-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{getTopicName(e.subject, e.topic_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString("it-IT", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
                <Badge variant={e.is_correct ? "default" : "secondary"} className="text-xs">
                  {e.is_correct ? "Corretto" : `${e.score ?? "—"}/100`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
