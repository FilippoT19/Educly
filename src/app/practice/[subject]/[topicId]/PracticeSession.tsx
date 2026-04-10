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
} from "lucide-react";
import type { AnswerCheckResult, SolutionStep } from "@/lib/claude";

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
}

type Phase =
  | "idle"
  | "loading_exercise"
  | "solving"
  | "correcting"
  | "solution"     // correct answer — shows solution sections
  | "step_review"  // wrong answer — reviewing steps one by one
  | "done";        // step review complete

const DIFFICULTY_LABELS = ["", "Facile", "Medio", "Difficile"];
const DIFFICULTY_COLORS = ["", "text-green-600", "text-yellow-600", "text-red-600"];

// A single step card used in step review
function StepCard({
  step,
  verdict,
  isCurrent,
  onYes,
  onNo,
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
        ? "border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800"
        : verdict === false
        ? "border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800"
        : "border-border bg-card"
    }`}>
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
          verdict === true
            ? "bg-green-600 text-white"
            : verdict === false
            ? "bg-red-500 text-white"
            : isCurrent
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}>
          {verdict === true ? <CheckCircle className="h-4 w-4" /> : verdict === false ? <XCircle className="h-4 w-4" /> : step.step}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{step.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{step.text}</p>
        </div>
      </div>

      {/* Formula — always shown */}
      {step.formula && (
        <div className="px-4 pb-3">
          <MathText text={`$$${step.formula}$$`} className="text-center" />
        </div>
      )}

      {/* Yes/No buttons only for current step */}
      {isCurrent && verdict === null && (
        <div className="px-4 pb-4 flex gap-3">
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={onYes}
          >
            Sì, l&apos;ho fatto
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onNo}>
            No, non l&apos;ho fatto
          </Button>
        </div>
      )}
    </div>
  );
}

// Accordion section for final solution view
function SolutionAccordion({
  step,
  missed,
}: {
  step: SolutionStep;
  missed: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border ${missed ? "border-red-300 dark:border-red-800" : "border-border"}`}>
      {/* Header — always visible */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          {missed ? (
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          )}
          <p className="font-semibold text-sm">{step.title}</p>
        </div>
        <p className="text-sm text-muted-foreground">{step.text}</p>
      </div>

      {/* Key formula */}
      {step.formula && (
        <div className="px-4 pb-3">
          <MathText text={`$$${step.formula}$$`} className="text-center" />
        </div>
      )}

      {/* Expandable detail */}
      {step.detail && (
        <div className="border-t border-border">
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{open ? "Nascondi dettagli" : "Mostra dettagli"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(false);
  const [error, setError] = useState("");
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<AnswerCheckResult | null>(null);

  // Step review
  const [stepIndex, setStepIndex] = useState(0);
  const [stepAnswers, setStepAnswers] = useState<boolean[]>([]); // true=correct, false=missed

  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [recommendation, setRecommendation] = useState<{
    exerciseId: string; topicId: string; reason: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  const successRate =
    stats && stats.exercises_done > 0
      ? Math.round((stats.correct / stats.exercises_done) * 100)
      : null;

  useEffect(() => {
    if (initialExerciseId) loadExercise(initialExerciseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExerciseId]);

  async function loadExercise(exerciseId?: string) {
    setPhase("loading_exercise");
    setExercise(null);
    setStudentAnswer("");
    setShowHints(false);
    setHintsUsed(false);
    setError("");
    setCheckResult(null);
    setStepIndex(0);
    setStepAnswers([]);
    setFinalScore(null);
    setRecommendation(null);
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
    setPhase("solving");
  }

  async function submitAnswer() {
    if (!exercise || !studentAnswer.trim()) {
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
        studentAnswer: studentAnswer.trim(),
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
      fetchRecommendation(score);
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
        studentAnswer,
        isCorrect: result.isCorrect,
        score,
        difficulty: exercise?.difficulty ?? 1,
        fullSolution: result.solutionSteps.map(s => s.detail).join("\n\n"),
      }),
    }).catch(() => {});
  }

  function fetchRecommendation(score: number) {
    const recUrl = new URL("/api/exercise/recommend", window.location.origin);
    recUrl.searchParams.set("subject", subject);
    recUrl.searchParams.set("topicId", topic.id);
    recUrl.searchParams.set("score", String(score));
    if (currentExerciseId) recUrl.searchParams.set("currentExerciseId", currentExerciseId);
    fetch(recUrl.toString())
      .then(r => r.json())
      .then(r => { if (r.recommendation) setRecommendation(r.recommendation); })
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
      const earnedWeight = steps.reduce(
        (sum, s, i) => sum + (newAnswers[i] ? s.weight : 0),
        0
      );
      const score = Math.min(earnedWeight, 75);
      setFinalScore(score);
      setPhase("done");
      saveResult(checkResult, score);
      fetchRecommendation(score);
    }
  }

  const steps: SolutionStep[] = checkResult?.solutionSteps ?? [];

  const NextExerciseBlock = () => (
    recommendation ? (
      <Card className="border-violet-200 bg-violet-50 dark:bg-violet-950 dark:border-violet-800">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200 mb-1">
                Consigliato per te
              </p>
              <p className="text-sm text-violet-700 dark:text-violet-300">{recommendation.reason}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => loadExercise(recommendation.exerciseId)}
            >
              Fai questo esercizio
            </Button>
            <Button variant="outline" onClick={() => loadExercise()}>Casuale</Button>
          </div>
        </CardContent>
      </Card>
    ) : (
      <Button size="lg" className="w-full" onClick={() => loadExercise()}>
        Prossimo esercizio
      </Button>
    )
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-4 gap-4">

        {/* IDLE */}
        {phase === "idle" && (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold mb-1">Pronto ad allenarti?</h2>
              <p className="text-muted-foreground text-sm">
                L&apos;AI genererà un esercizio calibrato sul tuo livello
              </p>
            </div>
            <Button size="lg" onClick={() => loadExercise()}>Genera esercizio</Button>
          </div>
        )}

        {/* LOADING */}
        {phase === "loading_exercise" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Generazione esercizio...</p>
          </div>
        )}

        {/* SOLVING */}
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
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                      <Lightbulb className="h-4 w-4" />
                      Suggerimenti
                      <span className="text-xs text-red-400">(punteggio max: 70)</span>
                    </p>
                    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                      <CardContent className="pt-4">
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
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Answer input with math keyboard */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Risultato finale</p>
              <MathKeyboard
                inputRef={inputRef}
                value={studentAnswer}
                onChange={setStudentAnswer}
              />
              <input
                ref={inputRef}
                type="text"
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAnswer(); }}
                placeholder="Es: 3/4, pi/2, sqrt(2), 0, inf..."
                disabled={phase === "correcting"}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 font-mono"
              />
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

        {/* SOLUTION — correct answer: shows all sections as accordion */}
        {phase === "solution" && checkResult && exercise && (
          <>
            <Card className="border-green-500 bg-green-50 dark:bg-green-950">
              <CardContent className="pt-5 flex items-center gap-4">
                <CheckCircle className="h-10 w-10 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-lg">Corretto!</p>
                  <p className="text-sm text-muted-foreground">
                    Punteggio: {finalScore}/100
                    {hintsUsed && " (suggerimenti usati)"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Soluzione
              </p>
              <div className="space-y-2">
                {steps.map((s) => (
                  <SolutionAccordion key={s.step} step={s} missed={false} />
                ))}
              </div>
            </div>

            <NextExerciseBlock />
          </>
        )}

        {/* STEP REVIEW — wrong answer: cumulative steps */}
        {phase === "step_review" && checkResult && exercise && (
          <>
            <Card className="border-red-400 bg-red-50 dark:bg-red-950">
              <CardContent className="pt-5 flex items-center gap-4">
                <XCircle className="h-10 w-10 text-red-500 shrink-0" />
                <div>
                  <p className="font-semibold text-lg">Non ancora...</p>
                  <p className="text-sm text-muted-foreground">
                    La risposta corretta è{" "}
                    <MathText text={checkResult.correctAnswer} className="inline font-medium" />
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Revisione passaggi — {stepIndex + 1} di {steps.length}
              </p>
              <div className="space-y-2">
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
            </div>
          </>
        )}

        {/* DONE — step review complete */}
        {phase === "done" && checkResult && exercise && (
          <>
            <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950">
              <CardContent className="pt-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center shrink-0">
                  <span className="font-bold text-orange-700 dark:text-orange-200 text-sm">
                    {finalScore}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">Revisione completata</p>
                  <p className="text-sm text-muted-foreground">
                    Punteggio: {finalScore}/100
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Soluzione
              </p>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <SolutionAccordion
                    key={s.step}
                    step={s}
                    missed={stepAnswers[i] === false}
                  />
                ))}
              </div>
            </div>

            <NextExerciseBlock />
          </>
        )}
      </div>
    </div>
  );
}
