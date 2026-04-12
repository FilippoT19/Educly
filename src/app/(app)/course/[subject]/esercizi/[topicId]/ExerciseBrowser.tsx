"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Sparkles, CheckCircle2, XCircle, Circle, BookOpen, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/MathText";
import { cn } from "@/lib/utils";
import { trackExerciseBrowserFiltered, trackExerciseSolutionViewed } from "@/lib/posthog";

interface Exercise {
  id: string;
  topic_id: string;
  difficulty: number;
  source: string;
  question_latex: string;
  solution_latex: string;
  hints: string[];
  tags: string[];
}

interface AttemptStatus {
  tried: boolean;
  passed: boolean;
  lastScore: number;
}

const DIFFICULTY_COLORS: Record<number, string> = {
  0: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  1: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  2: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  3: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};
const DIFFICULTY_LABELS: Record<number, string> = { 0: "Esempio", 1: "Facile", 2: "Medio", 3: "Difficile" };
const EXAM_COLOR = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

function difficultyKey(ex: Exercise) {
  return ex.source === "tema_passato" ? "exam" : String(ex.difficulty);
}

function StatusIcon({ status }: { status: AttemptStatus | undefined }) {
  if (!status) return <Circle className="h-4 w-4 text-muted-foreground/30" />;
  if (status.passed) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
}

interface Props {
  exercises: Exercise[];
  allTags: string[];
  subject: string;
  categoryId: string;
}

export function ExerciseBrowser({ exercises, allTags, subject, categoryId }: Props) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showHintsFor, setShowHintsFor] = useState<Record<string, boolean>>({});
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState<Record<string, AttemptStatus>>({});
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagQuery, setTagQuery] = useState("");

  useEffect(() => {
    fetch(`/api/exercise/attempts?subject=${subject}`)
      .then((r) => r.json())
      .then((d) => setAttempts(d.attempts ?? {}))
      .catch(() => {});
  }, [subject]);

  const filteredTags = tagQuery
    ? allTags.filter((t) => t.toLowerCase().includes(tagQuery.toLowerCase()))
    : allTags;

  const filtered = exercises.filter((ex) => {
    if (selectedDiff && difficultyKey(ex) !== selectedDiff) return false;
    if (selectedTag && !ex.tags?.includes(selectedTag)) return false;
    return true;
  });

  const diffCounts: Record<string, number> = {};
  for (const ex of exercises) {
    const k = difficultyKey(ex);
    diffCounts[k] = (diffCounts[k] || 0) + 1;
  }

  const tried = exercises.filter((e) => attempts[e.id]?.tried).length;
  const passed = exercises.filter((e) => attempts[e.id]?.passed).length;
  const pct = exercises.length > 0 ? Math.round((passed / exercises.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      {exercises.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Totale", value: exercises.length },
            { label: "Svolti", value: tried },
            { label: "Superati", value: `${passed} (${pct}%)` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border bg-card px-3 py-2.5 text-center">
              <p className="text-lg font-semibold tracking-tight">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Difficulty pills */}
        <button
          onClick={() => setSelectedDiff(null)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
            selectedDiff === null ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"
          )}
        >
          Tutti ({exercises.length})
        </button>
        {([["1", "Facile"], ["2", "Medio"], ["3", "Difficile"], ["exam", "Tema d'esame"]] as const).map(([k, label]) =>
          diffCounts[k] > 0 ? (
            <button
              key={k}
              onClick={() => { const next = selectedDiff === k ? null : k; setSelectedDiff(next); if (next) trackExerciseBrowserFiltered({ subject, categoryId, filterType: "difficulty", filterValue: k }); }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                selectedDiff === k
                  ? k === "exam" ? `${EXAM_COLOR} border-transparent` : `${DIFFICULTY_COLORS[parseInt(k) as 1|2|3]} border-transparent`
                  : "border-border hover:border-primary/40"
              )}
            >
              {label} ({diffCounts[k]})
            </button>
          ) : null
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Active tag badge */}
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/30"
            >
              {selectedTag}
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Advanced search toggle */}
          {allTags.length > 0 && (
            <button
              onClick={() => setShowTagSearch((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                showTagSearch ? "bg-muted border-border" : "border-border hover:border-primary/40"
              )}
            >
              <Search className="h-3 w-3" />
              Ricerca avanzata
            </button>
          )}

          {/* Generate */}
          <Link href={`/practice/${subject}/${categoryId}`}>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
              <Sparkles className="h-3 w-3" />
              Genera
            </Button>
          </Link>
        </div>
      </div>

      {/* Tag search panel */}
      {showTagSearch && (
        <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
          <input
            autoFocus
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Cerca argomento… es. integrazione per parti"
            className="w-full h-8 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {filteredTags.map((tag) => (
              <button
                key={tag}
                onClick={() => { const next = tag === selectedTag ? null : tag; setSelectedTag(next); setShowTagSearch(false); setTagQuery(""); if (next) trackExerciseBrowserFiltered({ subject, categoryId, filterType: "tag", filterValue: tag }); }}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                  selectedTag === tag
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
            {filteredTags.length === 0 && (
              <p className="text-xs text-muted-foreground">Nessun argomento trovato.</p>
            )}
          </div>
        </div>
      )}

      {/* Exercise list */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          Nessun esercizio trovato con i filtri selezionati.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex, i) => {
            const isOpen = expandedId === ex.id;
            const dk = difficultyKey(ex);
            const status = attempts[ex.id];
            const solShown = showSolution[ex.id];
            const hintsShown = showHintsFor[ex.id];

            const solveHref = `/practice/${subject}/${categoryId}?exerciseId=${ex.id}&back=/course/${subject}/esercizi/${categoryId}`;

            return (
              <div key={ex.id} className={cn(
                "border rounded-xl bg-card overflow-hidden",
                status?.passed ? "border-green-200 dark:border-green-900" : ""
              )}>
                {/* Collapsed row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status */}
                  <div className="shrink-0"><StatusIcon status={status} /></div>

                  {/* Number */}
                  <span className="text-xs text-muted-foreground font-mono shrink-0 w-5">{i + 1}.</span>

                  {/* Preview — click to expand */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : ex.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", dk === "exam" ? EXAM_COLOR : DIFFICULTY_COLORS[ex.difficulty])}>
                        {dk === "exam" ? "Tema d'esame" : DIFFICULTY_LABELS[ex.difficulty]}
                      </span>
                      {ex.tags?.slice(0, 2).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                    <div className="text-sm leading-snug line-clamp-1 text-muted-foreground">
                      <MathText text={ex.question_latex} />
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={solveHref}
                      className="inline-flex items-center h-7 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      {status?.tried ? (status.passed ? "Riprova" : "Riprova") : "Risolvi"}
                    </Link>
                    <button
                      onClick={() => setExpandedId(isOpen ? null : ex.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-4 bg-muted/10">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Testo completo</p>
                      <div className="text-sm leading-relaxed">
                        <MathText text={ex.question_latex} />
                      </div>
                    </div>

                    {/* Hints — hidden by default */}
                    {ex.hints?.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowHintsFor((s) => ({ ...s, [ex.id]: !s[ex.id] }))}
                          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", hintsShown && "rotate-180")} />
                          {hintsShown ? "Nascondi suggerimenti" : "Mostra suggerimenti"}
                        </button>
                        {hintsShown && (
                          <ul className="mt-2 space-y-1">
                            {ex.hints.map((h, hi) => (
                              <li key={hi} className="text-sm text-muted-foreground flex gap-2">
                                <span className="shrink-0 font-medium text-primary">{hi + 1}.</span>
                                <MathText text={h} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Solution — hidden by default */}
                    <div>
                      <button
                        onClick={() => { const next = !showSolution[ex.id]; setShowSolution((s) => ({ ...s, [ex.id]: next })); if (next) trackExerciseSolutionViewed({ subject, exerciseId: ex.id, difficulty: ex.difficulty }); }}
                        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        {solShown ? "Nascondi soluzione" : "Mostra soluzione"}
                      </button>
                      {solShown && (
                        <div className="mt-2 text-sm leading-relaxed">
                          <MathText text={ex.solution_latex} />
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {ex.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ex.tags.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
