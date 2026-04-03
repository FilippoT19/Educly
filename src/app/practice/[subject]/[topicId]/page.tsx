import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PracticeSession } from "./PracticeSession";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = {
  analisi1: analisi1 as typeof analisi1,
  analisi2: analisi2 as typeof analisi1,
};

interface PageProps {
  params: Promise<{ subject: string; topicId: string }>;
  searchParams: Promise<{ exerciseId?: string; back?: string }>;
}

export default async function PracticePage({ params, searchParams }: PageProps) {
  const { subject, topicId } = await params;
  const { exerciseId, back } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const curriculum = curricula[subject];
  if (!curriculum) redirect("/dashboard");

  // topicId might be a macro category id — find the right topic for stats
  const topic =
    curriculum.topics.find((t) => t.id === topicId) ??
    (() => {
      const cat = curriculum.macroCategories?.find((c) => c.id === topicId);
      return cat ? curriculum.topics.find((t) => t.id === cat.topicIds[0]) : null;
    })();

  if (!topic) redirect(`/course/${subject}/esercizi`);

  const { data: stats } = await supabase
    .from("topic_stats")
    .select("*")
    .eq("student_id", user.id)
    .eq("subject", subject)
    .eq("topic_id", topic.id)
    .single();

  const backHref = back ?? `/course/${subject}/esercizi/${topicId}`;

  return (
    <PracticeSession
      subject={subject}
      subjectName={curriculum.shortName}
      topic={topic}
      stats={stats}
      initialExerciseId={exerciseId}
      backHref={backHref}
    />
  );
}
