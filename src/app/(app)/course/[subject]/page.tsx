import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PenLine,
  BookOpen,
  GraduationCap,
  ClipboardList,
  ChevronRight,
  Lock,
} from "lucide-react";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = { analisi1, analisi2 };

const SECTIONS = [
  {
    id: "esercizi",
    label: "Esercizi",
    description: "Allenati con esercizi corretti dall'AI, calibrati sul tuo livello",
    icon: PenLine,
    color: "bg-blue-50 border-blue-200 text-blue-700",
    iconBg: "bg-blue-100",
    available: true,
  },
  {
    id: "teoria",
    label: "Teoria",
    description: "Lezioni interattive con spiegazioni, esempi e mini-quiz",
    icon: BookOpen,
    color: "bg-violet-50 border-violet-200 text-violet-700",
    iconBg: "bg-violet-100",
    available: false,
  },
  {
    id: "simulazione",
    label: "Simulazione esame",
    description: "Simula un esame completo con esercizi a tempo e voto finale",
    icon: ClipboardList,
    color: "bg-amber-50 border-amber-200 text-amber-700",
    iconBg: "bg-amber-100",
    available: false,
  },
  {
    id: "esame",
    label: "Preparazione esame",
    description: "Piano intensivo personalizzato sui tuoi punti deboli",
    icon: GraduationCap,
    color: "bg-green-50 border-green-200 text-green-700",
    iconBg: "bg-green-100",
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{curriculum.name}</h1>
        <p className="text-muted-foreground text-sm">{curriculum.shortName} · Politecnico</p>
      </div>

      {/* Course stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Argomenti avviati", value: `${topicsStarted}/${totalTopics}` },
          { label: "Esercizi svolti", value: totalExercises },
          { label: "Accuratezza", value: totalExercises > 0 ? `${accuracy}%` : "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sections */}
      <div className="grid sm:grid-cols-2 gap-3">
        {SECTIONS.map(({ id, label, description, icon: Icon, color, iconBg, available }) => {
          if (!available) {
            return (
              <div
                key={id}
                className="relative flex items-start gap-4 p-4 rounded-xl border bg-muted/30 opacity-60 cursor-not-allowed"
              >
                <div className={`p-2.5 rounded-lg bg-muted`}>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{label}</p>
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                  <Badge variant="secondary" className="mt-2 text-[10px]">Prossimamente</Badge>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={id}
              href={`/course/${subject}/${id}`}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-sm hover:-translate-y-0.5 ${color}`}
            >
              <div className={`p-2.5 rounded-lg ${iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs opacity-70 mt-0.5 leading-relaxed">{description}</p>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50 shrink-0 mt-0.5" />
            </Link>
          );
        })}
      </div>

      {/* Topics overview */}
      <div>
        <h2 className="text-base font-semibold mb-3">Argomenti</h2>
        <div className="space-y-2">
          {curriculum.topics.map((topic) => {
            const stat = statsMap.get(topic.id);
            const done = stat?.exercises_done || 0;
            const correct = stat?.correct || 0;
            const rate = done > 0 ? Math.round((correct / done) * 100) : null;

            return (
              <Link
                key={topic.id}
                href={`/course/${subject}/esercizi/${topic.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border bg-background hover:bg-muted/50 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                  {topic.order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{topic.name}</p>
                  {done > 0 && (
                    <Progress value={rate || 0} className="h-1 mt-1.5" />
                  )}
                </div>
                {rate !== null ? (
                  <Badge
                    variant={rate >= 70 ? "default" : rate >= 40 ? "secondary" : "destructive"}
                    className="text-xs shrink-0"
                  >
                    {rate}%
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">Non iniziato</span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
