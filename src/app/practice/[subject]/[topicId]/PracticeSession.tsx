"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MathText } from "@/components/MathText";
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
  solution?: string;
}

type Phase =
  | "idle"
  | "loading_exercise"
  | "solving"
  | "correcting"
  | "solution"       // shows full solution after correct answer
  | "step_review"    // wrong answer: going through steps one by one
  | "done";          // step review complete, shows final score

const DIFFICULTY_LABELS = ["", "Facile", "Medio", "Difficile"];
const DIFFICULTY_COLORS = ["", "text-green-600", "text-yellow-600", "text-red-600"];

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

  // Correction result
  const [checkResult, setCheckResult] = useState<AnswerCheckResult | null>(null);

  // Step review state
  const [stepIndex, setStepIndex] = useState(0);
  const [stepAnswers, setStepAnswers] = useState<boolean[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  // Recommendation
  const [recommendation, setRecommendation] = useState<{
    exerciseId: string; topicId: string; reason: string;
  } | null>(null);

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
        fullSolution: result.fullSolution,
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
      // All steps answered — calculate score
      const earnedWeight = steps.reduce(
        (sum, s, i) => sum + (newAnswers[i] ? s.weight : 0),
        0
      );
      const score = Math.min(earnedWeight, 75); // can't exceed 75 with wrong final answer
      setFinalScore(score);
      setPhase("done");
      saveResult(checkResult, score);
      fetchRecommendation(score);
    }
  }

  const steps: SolutionStep[] = checkResult?.solutionSteps ?? [];
  const missedSteps = steps.filter((_, i) => stepAnswers[i] === false);

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

            <div className="space-y-2">
              <p className="text-sm font-medium">Risultato finale</p>
              <input
                type="text"
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAnswer(); }}
                placeholder="Es: 3/4, π/2, sqrt(2), 0, diverge..."
                disabled={phase === "correcting"}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Scrivi solo il risultato. Puoi usare: pi, sqrt(), e^x, inf, ecc.
              </p>
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

        {/* SOLUTION — shown after correct answer */}
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Soluzione completa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MathText text={checkResult.fullSolution} className="text-sm leading-relaxed" />
              </CardContent>
            </Card>

            <NextExerciseBlock />
          </>
        )}

        {/* STEP REVIEW — shown after wrong answer, one step at a time */}
        {phase === "step_review" && checkResult && exercise && (
          <>
            {/* Wrong answer banner */}
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

            {/* Current step */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Revisione passaggi</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {stepIndex + 1} / {steps.length}
                  </span>
                </div>
                {/* Progress dots */}
                <div className="flex gap-1.5 pt-1">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < stepIndex
                          ? stepAnswers[i] ? "bg-green-500" : "bg-red-400"
                          : i === stepIndex
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4">
                  <MathText
                    text={steps[stepIndex].description}
                    className="text-sm leading-relaxed"
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground font-medium">
                  Hai eseguito questo passaggio correttamente?
                </p>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => answerStep(true)}
                  >
                    Sì, l&apos;ho fatto
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => answerStep(false)}
                  >
                    No, non l&apos;ho fatto
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Full solution (collapsed/visible for reference) */}
            <details className="group">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                Mostra soluzione completa
              </summary>
              <Card className="mt-2 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                <CardContent className="pt-4">
                  <MathText text={checkResult.fullSolution} className="text-sm leading-relaxed" />
                </CardContent>
              </Card>
            </details>
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
                    Punteggio parziale: {finalScore}/100
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Summary of missed steps */}
            {missedSteps.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Passaggi da rivedere
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {missedSteps.map((s) => (
                    <div key={s.step} className="text-sm bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
                      <MathText text={s.description} className="text-muted-foreground" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Full solution */}
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Soluzione corretta</CardTitle>
              </CardHeader>
              <CardContent>
                <MathText text={checkResult.fullSolution} className="text-sm leading-relaxed" />
              </CardContent>
            </Card>

            <NextExerciseBlock />
          </>
        )}
      </div>
    </div>
  );
}
