import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Target, BookOpen, TrendingUp, GraduationCap, LogOut } from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula = [analisi1, analisi2];

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: student }, { data: allStats }, { data: logs }] = await Promise.all([
    supabase.from("students").select("*").eq("id", user.id).single(),
    supabase.from("topic_stats").select("*").eq("student_id", user.id),
    supabase
      .from("exercise_log")
      .select("created_at, is_correct")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const stats = allStats || [];
  const totalExercises = stats.reduce((s, r) => s + r.exercises_done, 0);
  const totalCorrect = stats.reduce((s, r) => s + r.correct, 0);
  const accuracy = totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0;

  // Compute streak: consecutive days with at least 1 exercise
  const daySet = new Set((logs || []).map((l) => new Date(l.created_at).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (daySet.has(d.toDateString())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Per-subject breakdown
  const subjectBreakdown = curricula.map((c) => {
    const subjectStats = stats.filter((s) => s.subject === c.id);
    const done = subjectStats.reduce((s, r) => s + r.exercises_done, 0);
    const correct = subjectStats.reduce((s, r) => s + r.correct, 0);
    const topicsStarted = subjectStats.filter((s) => s.exercises_done > 0).length;
    const rate = done > 0 ? Math.round((correct / done) * 100) : 0;
    const allErrors = subjectStats.flatMap((s) => s.last_error_types as string[]);
    const errorCount: Record<string, number> = {};
    allErrors.forEach((e) => { errorCount[e] = (errorCount[e] || 0) + 1; });
    const topErrors = Object.entries(errorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => e);

    return {
      id: c.id,
      name: c.shortName,
      done,
      correct,
      rate,
      topicsStarted,
      totalTopics: c.topics.length,
      topErrors,
    };
  });

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
            {student?.full_name?.charAt(0) || "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold">{student?.full_name}</h1>
            <p className="text-sm text-muted-foreground">{student?.course}</p>
            <p className="text-xs text-muted-foreground">{student?.year}° anno · Politecnico</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </button>
        </form>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Streak", value: `${streak}g`, icon: Flame, color: "text-orange-500" },
          { label: "Esercizi", value: totalExercises, icon: BookOpen, color: "text-blue-600" },
          { label: "Corretti", value: totalCorrect, icon: Target, color: "text-green-600" },
          { label: "Accuratezza", value: `${accuracy}%`, icon: TrendingUp, color: "text-violet-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Streak visual */}
      {streak > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Flame className="h-8 w-8 text-orange-500" />
            <div>
              <p className="font-semibold">
                {streak === 1 ? "Hai iniziato la tua streak!" : `${streak} giorni consecutivi!`}
              </p>
              <p className="text-sm text-muted-foreground">Continua ad allenarti ogni giorno</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-subject breakdown */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Andamento per materia</h2>
        {subjectBreakdown.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  {s.name}
                </CardTitle>
                {s.done > 0 && (
                  <Badge
                    variant={s.rate >= 70 ? "default" : s.rate >= 40 ? "secondary" : "destructive"}
                  >
                    {s.rate}%
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.done === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun esercizio svolto ancora.</p>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Argomenti avviati</span>
                      <span>{s.topicsStarted}/{s.totalTopics}</span>
                    </div>
                    <Progress value={(s.topicsStarted / s.totalTopics) * 100} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Accuratezza ({s.correct}/{s.done} corretti)</span>
                      <span>{s.rate}%</span>
                    </div>
                    <Progress value={s.rate} className="h-1.5" />
                  </div>
                  {s.topErrors.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Errori frequenti</p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.topErrors.map((e) => (
                          <Badge key={e} variant="destructive" className="text-xs font-normal">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
