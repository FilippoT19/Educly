"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MathText } from "@/components/MathText";
import { MathKeyboard } from "@/components/MathKeyboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Lightbulb,
  BookOpen,
  Send,
  Target,
  ChevronDown,
  Shuffle,
} from "lucide-react";
import type { AnswerCheckResult, SolutionStep } from "@/lib/claude";
import type { RecommendationItem } from "@/app/api/exercise/recommend/route";

interface Topic {
  id: string;
  name: string;
  subtopics: string[];
}

interface TopicStats {
  exercises_done: number;
  correct: number;
}

interface Exercise {
  id?: string;
  text: string;
  difficulty: number;
  hints: string[];
  conceptTags?: string[];
  answerCount?: number;
  answerLabels?: string[];
}

type Phase =
  | "idle"
  | "loading_exercise"
  | "solving"
  | "correcting"
  | "solution"
  | "step_review"
  | "done";

const DIFFICULTY_LABELS = ["", "Facile", "Medio", "Difficile"];
const DIFFICULTY_COLORS = ["", "text-green-600", "text-yellow-600", "text-red-600"];

// ── Step card (step-by-step review) ─────────────────────────────────────────

function StepCard({
  step, verdict, isCurrent, onYes, onNo,
}: {
  step: SolutionStep;
  verdict: boolean | null;
  isCurrent: boolean;
  onYes?: () => void;
  onNo?: () => void;
}) {
  return (
    <div className={`rounded-xl border transition-colors ${
      verdict === true
        ? "border-green-300 bg-green-50/60 dark:bg-green-950/60 dark:border-green-800"
        : verdict === false
        ? "border-red-300 bg-red-50/60 dark:bg-red-950/60 dark:border-red-800"
        : "border-border bg-card"
    }`}>
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
          verdict === true ? "bg-green-600 text-white"
          : verdict === false ? "bg-red-500 text-white"
          : isCurrent ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
        }`}>
          {verdict === true ? <CheckCircle className="h-3.5 w-3.5" />
          : verdict === false ? <XCircle className="h-3.5 w-3.5" />
          : step.step}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug">{step.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{step.text}</p>
        </div>
      </div>
      {step.formula && (
        <div className="px-4 pb-2">
          <MathText text={`$$${step.formula}$$`} className="text-center" />
        </div>
      )}
      {isCurrent && verdict === null && (
        <div className="mx-4 mb-3 border-t border-border/60 pt-3">
          <p className="text-xs text-center text-muted-foreground mb-2.5">
            Hai eseguito questo passaggio correttamente?
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={onYes}>
              Sì, l&apos;ho fatto
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={onNo}>
              No, non l&apos;ho fatto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Solution accordion ────────────────────────────────────────────────────────

function SolutionAccordion({ step, missed }: { step: SolutionStep; missed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border ${missed ? "border-red-300 dark:border-red-800" : "border-border"}`}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-0.5">
          {missed
            ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            : <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />}
          <p className="font-semibold text-sm">{step.title}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{step.text}</p>
      </div>
      {step.formula && (
        <div className="px-4 pb-2">
          <MathText text={`$$${step.formula}$$`} className="text-center" />
        </div>
      )}
      {step.detail && (
        <div className="border-t border-border/60">
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{open ? "Nascondi dettagli" : "Mostra dettagli"}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="px-4 pb-4">
              <MathText text={step.detail} className="text-sm leading-relaxed text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  onStart,
}: {
  rec: RecommendationItem;
  onStart: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border ${
      rec.isTop
        ? "border-violet-300 bg-violet-50 dark:bg-violet-950 dark:border-violet-800"
        : "border-border bg-card"
    }`}>
      <div className="px-3 pt-3 pb-2 space-y-1">
        {rec.isTop ? (
          <div className="flex items-center gap-1.5">
            <Target className="h-3 w-3 text-violet-600 shrink-0" />
            <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
              Consigliato per te
            </span>
          </div>
        ) : (
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Alternativa</p>
        )}
        {/* Preview — always visible, clamped */}
        <div className={`text-xs leading-snug text-foreground/80 ${expanded ? "" : "line-clamp-3"}`}>
          <MathText text={rec.questionPreview} className="text-xs" />
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors border-t border-border/40"
      >
        <span>{expanded ? "Comprimi" : "Vedi tutto l'esercizio"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className="px-3 pb-3">
        <Button
          size="sm"
          className={`w-full ${rec.isTop ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}`}
          variant={rec.isTop ? "default" : "outline"}
          onClick={onStart}
        >
          Inizia questo esercizio
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PracticeSession({
  subject,
  subjectName,
  topic,
  stats,
  initialExerciseId,
  backHref,
}: {
  subject: string;
  subjectName: string;
  topic: Topic;
  stats: TopicStats | null;
  initialExerciseId?: string;
  backHref?: string;
}) {
  const [phase, setPhase]       = useState<Phase>("idle");
  const [exercise, setExercise] = useState<Exercise | null>(null);

  // ── Answer state ──────────────────────────────────────────────────────────
  // studentAnswers[i] = answer for part i (always at least length 1)
  const [studentAnswers, setStudentAnswers] = useState<string[]>([""]);
  const [activeAnswerIdx, setActiveAnswerIdx] = useState(0);
  // Shared ref passed to MathKeyboard — updated to whichever input is focused
  const mathKbRef = useRef<HTMLInputElement | null>(null);

  const [showHints, setShowHints]   = useState(false);
  const [hintsUsed, setHintsUsed]   = useState(false);
  const [error, setError]           = useState("");
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<AnswerCheckResult | null>(null);

  const [stepIndex, setStepIndex]   = useState(0);
  const [stepAnswers, setStepAnswers] = useState<boolean[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);

  const savedRef = useRef(false);

  const successRate =
    stats && stats.exercises_done > 0
      ? Math.round((stats.correct / stats.exercises_done) * 100)
      : null;

  useEffect(() => {
    if (initialExerciseId) loadExercise(initialExerciseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExerciseId]);

  // Combined answer string for the backend
  const combinedAnswer = studentAnswers.map(s => s.trim()).filter(Boolean).join(", ");

  // Labels for each answer slot
  function getAnswerLabels(ex: Exercise): string[] {
    if (ex.answerLabels && ex.answerLabels.length > 0) return ex.answerLabels;
    const count = ex.answerCount ?? 1;
    return Array.from({ length: count }, (_, i) =>
      count === 1 ? "Risultato" : String.fromCharCode(97 + i) + ")"
    );
  }

  async function loadExercise(exerciseId?: string) {
    setPhase("loading_exercise");
    setExercise(null);
    setStudentAnswers([""]);
    setActiveAnswerIdx(0);
    setShowHints(false);
    setHintsUsed(false);
    setError("");
    setCheckResult(null);
    setStepIndex(0);
    setStepAnswers([]);
    setFinalScore(null);
    setRecommendations([]);
    savedRef.current = false;

    const res = await fetch("/api/exercise/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, topicId: topic.id, exerciseId }),
    });

    if (!res.ok) {
      setError("Errore nel caricare l'esercizio. Riprova.");
      setPhase("idle");
      return;
    }

    const data = await res.json();
    setCurrentExerciseId(data.id ?? null);
    setExercise(data);
    // Initialize one slot per exact answer (min 1)
    const count = Math.max(1, data.answerCount || 1);
    setStudentAnswers(new Array(count).fill(""));
    setPhase("solving");
  }

  async function submitAnswer() {
    if (!exercise || !combinedAnswer) {
      setError("Scrivi la tua risposta prima di inviare.");
      return;
    }
    setError("");
    setPhase("correcting");

    const res = await fetch("/api/exercise/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        topicName: topic.name,
        exerciseText: exercise.text,
        studentAnswer: combinedAnswer,
        exerciseId: currentExerciseId ?? undefined,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setError(errData.error ?? "Errore nella correzione. Riprova.");
      setPhase("solving");
      return;
    }

    const result: AnswerCheckResult = await res.json();
    setCheckResult(result);

    if (result.isCorrect) {
      const score = hintsUsed ? 70 : 100;
      setFinalScore(score);
      setPhase("solution");
      saveResult(result, score);
      fetchRecommendations(score);
    } else {
      setStepIndex(0);
      setStepAnswers([]);
      setPhase("step_review");
    }
  }

  function saveResult(result: AnswerCheckResult, score: number) {
    if (savedRef.current) return;
    savedRef.current = true;
    fetch("/api/exercise/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        topicId: topic.id,
        exerciseId: currentExerciseId,
        exerciseText: exercise?.text ?? "",
        studentAnswer: combinedAnswer,
        isCorrect: result.isCorrect,
        score,
        difficulty: exercise?.difficulty ?? 1,
        fullSolution: result.solutionSteps.map(s => s.detail).join("\n\n"),
        conceptTags: exercise?.conceptTags ?? [],
      }),
    }).catch(() => {});
  }

  function fetchRecommendations(score: number) {
    const recUrl = new URL("/api/exercise/recommend", window.location.origin);
    recUrl.searchParams.set("subject", subject);
    recUrl.searchParams.set("topicId", topic.id);
    recUrl.searchParams.set("score", String(score));
    if (currentExerciseId) recUrl.searchParams.set("currentExerciseId", currentExerciseId);
    fetch(recUrl.toString())
      .then(r => r.json())
      .then(r => { if (r.recommendations) setRecommendations(r.recommendations); })
      .catch(() => {});
  }

  function answerStep(correct: boolean) {
    if (!checkResult) return;
    const steps = checkResult.solutionSteps;
    const newAnswers = [...stepAnswers, correct];
    setStepAnswers(newAnswers);

    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      const earnedWeight = steps.reduce((sum, s, i) => sum + (newAnswers[i] ? s.weight : 0), 0);
      const score = Math.min(earnedWeight, 75);
      setFinalScore(score);
      setPhase("done");
      saveResult(checkResult, score);
      fetchRecommendations(score);
    }
  }

  const steps: SolutionStep[] = checkResult?.solutionSteps ?? [];

  const partialScore = steps.slice(0, stepAnswers.length).reduce(
    (sum, s, i) => sum + (stepAnswers[i] ? s.weight : 0), 0
  );

  // ── Shared UI blocks ──────────────────────────────────────────────────────

  const ScoreCard = ({ score, label, color }: { score: number; label: string; color: "green" | "orange" }) => (
    <Card className={color === "green"
      ? "border-green-400 bg-green-50 dark:bg-green-950"
      : "border-orange-400 bg-orange-50 dark:bg-orange-950"
    }>
      <CardContent className="pt-4 pb-4 text-center">
        <p className="text-4xl font-bold tracking-tight">{score}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );

  // 3 recommendation cards + random button
  const RecommendationSection = () => (
    <div className="space-y-2">
      {recommendations.length > 0 ? (
        <>
          {recommendations.length > 1 && (
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
              Esercizi consigliati per te
            </p>
          )}
          {recommendations.map(rec => (
            <RecommendationCard
              key={rec.exerciseId}
              rec={rec}
              onStart={() => loadExercise(rec.exerciseId)}
            />
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-muted-foreground gap-1.5"
            onClick={() => loadExercise()}
          >
            <Shuffle className="h-3.5 w-3.5" />
            Esercizio casuale
          </Button>
        </>
      ) : (
        <Button className="w-full" onClick={() => loadExercise()}>
          Prossimo esercizio
        </Button>
      )}
    </div>
  );

  const ExerciseRecap = () => {
    if (!exercise) return null;
    const labels = getAnswerLabels(exercise);
    const hasAnswers = studentAnswers.some(a => a.trim());
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Esercizio</p>
          <Badge variant="outline" className={`text-[11px] ${DIFFICULTY_COLORS[exercise.difficulty]}`}>
            {DIFFICULTY_LABELS[exercise.difficulty]}
          </Badge>
        </div>
        <MathText text={exercise.text} className="text-sm leading-relaxed" />
        {hasAnswers && (
          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60 space-y-0.5">
            <p className="font-medium">
              {studentAnswers.length === 1 ? "La tua risposta:" : "Le tue risposte:"}
            </p>
            {studentAnswers.map((a, i) => a.trim() ? (
              <p key={i}>
                {studentAnswers.length > 1 && <span className="font-medium">{labels[i]} </span>}
                <span className="font-mono">{a}</span>
              </p>
            ) : null)}
          </div>
        )}
      </div>
    );
  };

  // ── Header ────────────────────────────────────────────────────────────────

  const header = (
    <header className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
      <Link
        href={backHref ?? `/course/${subject}`}
        className="inline-flex items-center justify-center rounded-lg size-8 hover:bg-muted transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{subjectName}</p>
        <h1 className="font-semibold leading-tight">{topic.name}</h1>
      </div>
      {stats && (
        <div className="text-right text-sm">
          <p className="font-medium">{stats.exercises_done} esercizi</p>
          {successRate !== null && (
            <p className="text-xs text-muted-foreground">{successRate}% corretti</p>
          )}
        </div>
      )}
    </header>
  );

  // ── IDLE / LOADING / SOLVING / CORRECTING ─────────────────────────────────

  if (phase === "idle" || phase === "loading_exercise" || phase === "solving" || phase === "correcting") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {header}
        <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-6 gap-4">

          {phase === "idle" && (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-4">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold mb-1">Pronto ad allenarti?</h2>
                <p className="text-muted-foreground text-sm">
                  Riceverai un esercizio calibrato sul tuo livello
                </p>
              </div>
              <Button size="lg" onClick={() => loadExercise()}>Inizia</Button>
            </div>
          )}

          {phase === "loading_exercise" && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Caricamento esercizio...</p>
            </div>
          )}

          {(phase === "solving" || phase === "correcting") && exercise && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Esercizio</CardTitle>
                    <Badge variant="outline" className={DIFFICULTY_COLORS[exercise.difficulty]}>
                      {DIFFICULTY_LABELS[exercise.difficulty]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <MathText text={exercise.text} className="leading-relaxed" />
                </CardContent>
              </Card>

              {exercise.hints.length > 0 && (
                <div>
                  {!showHints ? (
                    <button
                      onClick={() => { setShowHints(true); setHintsUsed(true); }}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-amber-600 transition-colors"
                    >
                      <Lightbulb className="h-4 w-4" />
                      Mostra suggerimenti
                      <span className="text-xs text-red-400 font-medium">(max 70 pt)</span>
                    </button>
                  ) : (
                    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                      <CardContent className="pt-4">
                        <p className="flex items-center gap-2 text-sm text-amber-600 font-medium mb-2">
                          <Lightbulb className="h-4 w-4" />
                          Suggerimenti
                          <span className="text-xs text-red-400">(max: 70 pt)</span>
                        </p>
                        <ul className="space-y-1">
                          {exercise.hints.map((h, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-amber-600 font-medium">{i + 1}.</span>
                              <MathText text={h} />
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              <Separator />

              {/* ── Answer inputs ── */}
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {studentAnswers.length > 1 ? "Le tue risposte" : "Risultato finale"}
                </p>

                {/* Shared math keyboard */}
                <MathKeyboard
                  inputRef={mathKbRef}
                  value={studentAnswers[activeAnswerIdx] ?? ""}
                  onChange={(v) => {
                    setStudentAnswers(prev => {
                      const next = [...prev];
                      next[activeAnswerIdx] = v;
                      return next;
                    });
                  }}
                />

                {/* One input per answer slot */}
                <div className="space-y-2">
                  {studentAnswers.map((val, i) => {
                    const labels = getAnswerLabels(exercise);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        {studentAnswers.length > 1 && (
                          <span className="text-sm font-semibold text-muted-foreground w-6 shrink-0 text-right">
                            {labels[i]}
                          </span>
                        )}
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStudentAnswers(prev => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                          onFocus={(e) => {
                            mathKbRef.current = e.currentTarget;
                            setActiveAnswerIdx(i);
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter" && i === studentAnswers.length - 1) submitAnswer(); }}
                          placeholder={studentAnswers.length === 1 ? "Es: 3/4, pi/2, sqrt(2)…" : `Risposta ${labels[i]}`}
                          disabled={phase === "correcting"}
                          className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 font-mono"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button
                size="lg"
                className="w-full gap-2"
                onClick={submitAnswer}
                disabled={phase === "correcting"}
              >
                {phase === "correcting" ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Correzione in corso...</>
                ) : (
                  <><Send className="h-4 w-4" /> Invia risposta</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── SOLUTION / STEP_REVIEW / DONE — two-column layout ────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {header}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-[1fr_280px] gap-6 items-start">

          {/* LEFT */}
          <div className="space-y-4 min-w-0">
            <ExerciseRecap />

            {phase === "solution" && checkResult && (
              <div className="space-y-3">
                <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Soluzione
                </p>
                {steps.map(s => <SolutionAccordion key={s.step} step={s} missed={false} />)}
              </div>
            )}

            {phase === "step_review" && checkResult && (
              <div className="space-y-3">
                <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Revisione passaggi — {stepIndex + 1} di {steps.length}
                </p>
                {steps.slice(0, stepIndex + 1).map((s, i) => (
                  <StepCard
                    key={s.step}
                    step={s}
                    verdict={i < stepAnswers.length ? stepAnswers[i] : null}
                    isCurrent={i === stepIndex}
                    onYes={() => answerStep(true)}
                    onNo={() => answerStep(false)}
                  />
                ))}
              </div>
            )}

            {phase === "done" && checkResult && (
              <div className="space-y-3">
                <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Soluzione
                </p>
                {steps.map((s, i) => (
                  <SolutionAccordion key={s.step} step={s} missed={stepAnswers[i] === false} />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — sticky sidebar */}
          <div className="md:sticky md:top-6 space-y-3">

            {phase === "solution" && (
              <>
                <ScoreCard
                  score={finalScore ?? 100}
                  label={hintsUsed ? "punti (suggerimenti usati)" : "punti su 100"}
                  color="green"
                />
                <RecommendationSection />
              </>
            )}

            {phase === "step_review" && checkResult && (
              <>
                <Card className="border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <p className="text-sm font-semibold">Risposta sbagliata</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Risposta corretta:</p>
                    <MathText text={checkResult.correctAnswer} className="text-sm font-medium" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>{stepIndex + 1} / {steps.length}</span>
                    </div>
                    <div className="flex gap-1">
                      {steps.map((_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i < stepAnswers.length
                            ? stepAnswers[i] ? "bg-green-500" : "bg-red-400"
                            : i === stepIndex ? "bg-primary" : "bg-muted"
                        }`} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Punteggio parziale</span>
                      <span className="font-semibold">{partialScore} / 75</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {phase === "done" && (
              <>
                <ScoreCard score={finalScore ?? 0} label="punti su 100" color="orange" />
                <RecommendationSection />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
