import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PenLine, BookOpen, GraduationCap, ClipboardList, ChevronRight, Lock } from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = { analisi1, analisi2 };

const SECTIONS = [
  {
    id: "esercizi",
    label: "Esercizi",
    description: "Allenati con esercizi corretti dall'AI",
    icon: PenLine,
    available: true,
  },
  {
    id: "teoria",
    label: "Teoria",
    description: "Lezioni interattive con mini-quiz",
    icon: BookOpen,
    available: false,
  },
  {
    id: "simulazione",
    label: "Simulazione esame",
    description: "Esame completo a tempo con voto finale",
    icon: ClipboardList,
    available: false,
  },
  {
    id: "esame",
    label: "Preparazione esame",
    description: "Piano intensivo sui tuoi punti deboli",
    icon: GraduationCap,
    available: false,
  },
];

interface PageProps {
  params: Promise<{ subject: string }>;
}

export default async function CoursePage({ params }: PageProps) {
  const { subject } = await params;
  const curriculum = curricula[subject];
  if (!curriculum) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: allStats } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user!.id)
    .eq("subject", subject);

  const stats = allStats || [];
  const statsMap = new Map(stats.map((s) => [s.topic_id, s]));
  const totalTopics = curriculum.topics.length;
  const topicsStarted = stats.filter((s) => s.exercises_done > 0).length;
  const totalExercises = stats.reduce((s, r) => s + r.exercises_done, 0);
  const totalCorrect = stats.reduce((s, r) => s + r.correct, 0);
  const accuracy = totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div className="pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">{curriculum.name}</h1>
        <p className="text-[15px] text-muted-foreground mt-1">{curriculum.shortName} · Politecnico</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Argomenti avviati", value: `${topicsStarted}/${totalTopics}` },
          { label: "Esercizi svolti",   value: totalExercises },
          { label: "Accuratezza",       value: totalExercises > 0 ? `${accuracy}%` : "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3.5 text-center">
              <p className="text-xl font-semibold tracking-tight">{value}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sections */}
      <div>
        <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Sezioni
        </h2>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {SECTIONS.map(({ id, label, description, icon: Icon, available }) => {
            if (!available) {
              return (
                <div
                  key={id}
                  className="flex items-center gap-3.5 p-4 rounded-xl border bg-card opacity-50 cursor-not-allowed"
                >
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13.5px] font-medium">{label}</p>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={id}
                href={`/course/${subject}/${id}`}
                className="flex items-center gap-3.5 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-primary/8 shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium">{label}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Topics */}
      <div>
        <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Argomenti
        </h2>
        <Card>
          <CardContent className="py-0 divide-y divide-border">
            {curriculum.topics.map((topic) => {
              const stat = statsMap.get(topic.id);
              const done = stat?.exercises_done || 0;
              const correct = stat?.correct || 0;
              const rate = done > 0 ? Math.round((correct / done) * 100) : null;

              return (
                <Link
                  key={topic.id}
                  href={`/course/${subject}/esercizi/${topic.id}`}
                  className="flex items-center gap-3.5 py-3.5 hover:bg-muted/40 transition-colors -mx-4 px-4 first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground shrink-0">
                    {topic.order}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium">{topic.name}</p>
                    {done > 0 && (
                      <Progress value={rate || 0} className="h-[3px] mt-1.5" />
                    )}
                  </div>
                  {rate !== null ? (
                    <Badge
                      variant={rate >= 70 ? "default" : rate >= 40 ? "secondary" : "destructive"}
                      className="text-[11px] shrink-0"
                    >
                      {rate}%
                    </Badge>
                  ) : (
                    <span className="text-[12px] text-muted-foreground shrink-0">Non avviato</span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
