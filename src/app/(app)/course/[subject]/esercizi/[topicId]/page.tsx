import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ExerciseBrowser } from "./ExerciseBrowser";
import analisi1 from "@/content/analisi1.json";
import analisi2 from "@/content/analisi2.json";

const curricula: Record<string, typeof analisi1> = {
  analisi1: analisi1 as typeof analisi1,
  analisi2: analisi2 as unknown as typeof analisi1,
};

interface PageProps {
  params: Promise<{ subject: string; topicId: string }>;
}

export default async function EserciziCategoryPage({ params }: PageProps) {
  const { subject, topicId } = await params;
  const curriculum = curricula[subject];
  if (!curriculum) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // topicId is now a macro category id
  const macroCategories = curriculum.macroCategories ?? [];
  const category = macroCategories.find((c) => c.id === topicId);

  // Fallback: if topicId is a raw topic id (old links), find its macro category
  const resolvedCategory = category ?? macroCategories.find((c) => c.topicIds.includes(topicId)) ?? null;

  if (!resolvedCategory) notFound();

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, topic_id, difficulty, source, question_latex, solution_latex, hints, tags")
    .eq("subject", subject)
    .in("topic_id", resolvedCategory.topicIds)
    .order("difficulty", { ascending: true });

  const allExercises = exercises || [];

  // Collect all unique tags from exercises (not just suggested)
  const tagSet = new Set<string>();
  for (const ex of allExercises) {
    for (const t of (ex.tags || [])) tagSet.add(t);
  }
  const allTags = Array.from(tagSet).sort();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="pt-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href={`/course/${subject}`} className="hover:text-foreground transition-colors">
            {curriculum.shortName}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/course/${subject}/esercizi`} className="hover:text-foreground transition-colors">
            Esercizi
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{resolvedCategory.name}</span>
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight mt-3">{resolvedCategory.name}</h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          {allExercises.length} esercizi disponibili
        </p>
      </div>

      <ExerciseBrowser
        exercises={allExercises}
        allTags={allTags}
        subject={subject}
        categoryId={resolvedCategory.id}
      />
    </div>
  );
}
