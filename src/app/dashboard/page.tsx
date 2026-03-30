import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, BookOpen, TrendingUp, Zap } from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula = [analisi1, analisi2];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: allStats } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user.id);

  const statsMap = new Map(
    (allStats || []).map((s) => [`${s.subject}-${s.topic_id}`, s])
  );

  const totalExercises = (allStats || []).reduce((sum, s) => sum + s.exercises_done, 0);
  const totalCorrect = (allStats || []).reduce((sum, s) => sum + s.correct, 0);
  const overallRate = totalExercises > 0
    ? Math.round((totalCorrect / totalExercises) * 100)
    : null;

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">Educly</h1>
          {student && (
            <p className="text-xs text-muted-foreground">
              {student.full_name} · {student.course}
            </p>
          )}
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Overview stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{totalExercises}</p>
              <p className="text-xs text-muted-foreground mt-1">Esercizi</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{totalCorrect}</p>
              <p className="text-xs text-muted-foreground mt-1">Corretti</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">
                {overallRate !== null ? `${overallRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Accuratezza</p>
            </CardContent>
          </Card>
        </div>

        {/* Subject tabs */}
        <Tabs defaultValue="analisi1">
          <TabsList className="w-full">
            <TabsTrigger value="analisi1" className="flex-1">Analisi 1</TabsTrigger>
            <TabsTrigger value="analisi2" className="flex-1">Analisi 2</TabsTrigger>
          </TabsList>

          {curricula.map((curriculum) => (
            <TabsContent key={curriculum.id} value={curriculum.id} className="space-y-3 mt-4">
              {curriculum.topics.map((topic) => {
                const key = `${curriculum.id}-${topic.id}`;
                const stat = statsMap.get(key);
                const done = stat?.exercises_done || 0;
                const correct = stat?.correct || 0;
                const rate = done > 0 ? Math.round((correct / done) * 100) : null;

                return (
                  <Card key={topic.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm">{topic.name}</h3>
                            {rate !== null && (
                              <Badge
                                variant={rate >= 70 ? "default" : rate >= 40 ? "secondary" : "destructive"}
                                className="text-xs"
                              >
                                {rate}%
                              </Badge>
                            )}
                          </div>
                          {done > 0 && (
                            <div className="mt-2 space-y-1">
                              <Progress value={rate || 0} className="h-1.5" />
                              <p className="text-xs text-muted-foreground">
                                {correct}/{done} corretti
                              </p>
                            </div>
                          )}
                          {done === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">Non ancora praticato</p>
                          )}
                        </div>
                        <Button asChild size="sm" variant={done === 0 ? "default" : "outline"}>
                          <Link href={`/practice/${curriculum.id}/${topic.id}`}>
                            {done === 0 ? (
                              <><Zap className="h-3 w-3 mr-1" /> Inizia</>
                            ) : rate !== null && rate < 60 ? (
                              <><TrendingUp className="h-3 w-3 mr-1" /> Riprova</>
                            ) : (
                              <><BookOpen className="h-3 w-3 mr-1" /> Pratica</>
                            )}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
