import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Target, BookOpen, TrendingUp, LogOut } from "lucide-react";
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

  const daySet = new Set((logs || []).map((l) => new Date(l.created_at).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (daySet.has(d.toDateString())) streak++;
    else if (i > 0) break;
  }

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
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => e);
    return { id: c.id, name: c.shortName, done, correct, rate, topicsStarted, totalTopics: c.topics.length, topErrors };
  });

  async function signOut() {
    "use server";
    const s = await createClient();
    await s.auth.signOut();
    redirect("/login");
  }

  const initials = student?.full_name
    ?.split(" ").slice(0, 2).map((w: string) => w[0]).join("") || "?";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[16px] font-semibold shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">{student?.full_name}</h1>
            <p className="text-[13.5px] text-muted-foreground">{student?.course}</p>
            <p className="text-[12px] text-muted-foreground">{student?.year}° anno · Politecnico</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Esci
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Streak",      value: streak > 0 ? `${streak}g` : "—", icon: Flame },
          { label: "Esercizi",    value: totalExercises,                   icon: BookOpen },
          { label: "Corretti",    value: totalCorrect,                     icon: Target },
          { label: "Accuratezza", value: totalExercises > 0 ? `${accuracy}%` : "—", icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3.5 text-center">
              <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
              <p className="text-xl font-semibold tracking-tight">{value}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-subject */}
      <div>
        <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Andamento per materia
        </h2>
        <div className="space-y-3">
          {subjectBreakdown.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-4 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-[14px]">{s.name}</p>
                  {s.done > 0 && (
                    <Badge variant={s.rate >= 70 ? "default" : s.rate >= 40 ? "secondary" : "destructive"}>
                      {s.rate}%
                    </Badge>
                  )}
                </div>

                {s.done === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Nessun esercizio svolto.</p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                        <span>Argomenti avviati</span>
                        <span>{s.topicsStarted}/{s.totalTopics}</span>
                      </div>
                      <Progress value={(s.topicsStarted / s.totalTopics) * 100} className="h-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                        <span>Accuratezza ({s.correct}/{s.done} corretti)</span>
                        <span>{s.rate}%</span>
                      </div>
                      <Progress value={s.rate} className="h-1" />
                    </div>
                    {s.topErrors.length > 0 && (
                      <div>
                        <p className="text-[12px] text-muted-foreground mb-2">Errori frequenti</p>
                        <div className="flex flex-wrap gap-1.5">
                          {s.topErrors.map((e) => (
                            <Badge key={e} variant="destructive" className="text-[11px] font-normal">{e}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
