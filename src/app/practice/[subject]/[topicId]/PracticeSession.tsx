"use client";

import { useState, useEffect } from "react";
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
  ChevronRight,
} from "lucide-react";

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
  answerType?: "exact" | "open";
  solutionExact?: string | null;
  solutionSteps?: string[];
  solution?: string; // solution_latex from DB
}

interface CorrectionStep {
  step: number;
  label: string;
  correct: boolean;
  comment: string;
}

interface Correction {
  isCorrect: boolean;
  score: number;
  errorTypes: string[];
  steps: CorrectionStep[];
  solutionLatex: string;
  whatToReview: string[];
  solutionSteps?: string[];
}

type Phase = "idle" | "loading_exercise" | "solving" | "correcting" | "feedback";

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
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(false);
  const [error, setError] = useState("");
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<{
    exerciseId: string; topicId: string; reason: string;
  } | null>(null);

  // Interactive step review state
  const [stepReviewIndex, setStepReviewIndex] = useState<number | null>(null);
  const [stepResults, setStepResults] = useState<boolean[]>([]);

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
    setCorrection(null);
    setStudentAnswer("");
    setShowHints(false);
    setHintsUsed(false);
    setError("");
    setRecommendation(null);
    setStepReviewIndex(null);
    setStepResults([]);

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

  async function submitSolution() {
    if (!exercise) return;

    if (!studentAnswer.trim()) {
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
        topicId: topic.id,
        topicName: topic.name,
        exerciseText: exercise.text,
        difficulty: exercise.difficulty,
        hintsUsed,
        studentAnswer: studentAnswer.trim(),
        answerType: exercise.answerType || "open",
        solutionExact: exercise.solutionExact || null,
        solutionLatex: exercise.solution || null,
        solutionSteps: exercise.solutionSteps || [],
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setError(errData.error ?? "Errore nella correzione. Riprova.");
      setPhase("solving");
      return;
    }

    const data = await res.json();
    setCorrection(data);
    setPhase("feedback");

    if (currentExerciseId) {
      fetch("/api/exercise/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: currentExerciseId,
          isCorrect: data.isCorrect,
          score: data.score,
        }),
      }).catch(() => {});
    }

    // Fetch recommendation
    const recUrl = new URL("/api/exercise/recommend", window.location.origin);
    recUrl.searchParams.set("subject", subject);
    recUrl.searchParams.set("topicId", topic.id);
    recUrl.searchParams.set("score", String(data.score));
    if (currentExerciseId) recUrl.searchParams.set("currentExerciseId", currentExerciseId);
    fetch(recUrl.toString())
      .then(r => r.json())
      .then(r => { if (r.recommendation) setRecommendation(r.recommendation); })
      .catch(() => {});
  }

  function startStepReview() {
    setStepReviewIndex(0);
    setStepResults([]);
  }

  function answerStep(correct: boolean) {
    const steps = correction?.solutionSteps || [];
    const newResults = [...stepResults, correct];
    setStepResults(newResults);
    if (stepReviewIndex !== null && stepReviewIndex < steps.length - 1) {
      setStepReviewIndex(stepReviewIndex + 1);
    } else {
      setStepReviewIndex(-1); // done
    }
  }

  const reviewSteps = correction?.solutionSteps || [];
  const missedSteps = stepResults
    .map((ok, i) => (!ok ? i + 1 : null))
    .filter(Boolean) as number[];

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

        {/* START STATE */}
        {phase === "idle" && (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold mb-1">Pronto ad allenarti?</h2>
              <p className="text-muted-foreground text-sm">
                L&apos;AI genererà un esercizio calibrato sul tuo livello
              </p>
            </div>
            <Button size="lg" onClick={() => loadExercise()}>
              Genera esercizio
            </Button>
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
            {/* Exercise text */}
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

            {/* Hints */}
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

            {/* Answer input */}
            <div className="space-y-2">
              <p className="text-sm font-medium">La tua risposta</p>
              <textarea
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                placeholder={
                  exercise.answerType === "exact"
                    ? "Scrivi il risultato finale (es: 3/4, π/2, 0)..."
                    : "Scrivi la tua soluzione passo per passo..."
                }
                disabled={phase === "correcting"}
                rows={exercise.answerType === "exact" ? 2 : 6}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 resize-none font-mono"
              />
              {exercise.answerType === "open" && (
                <p className="text-xs text-muted-foreground">
                  Puoi usare notazione matematica: es. sqrt(2), pi/4, integral, lim_{"{x→0}"}
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button
              size="lg"
              className="w-full gap-2"
              onClick={submitSolution}
              disabled={phase === "correcting"}
            >
              {phase === "correcting" ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Correzione in corso...</>
              ) : (
                <><Send className="h-4 w-4" /> Invia per correzione</>
              )}
            </Button>
          </>
        )}

        {/* FEEDBACK */}
        {phase === "feedback" && correction && exercise && (
          <>
            {/* Result card */}
            <Card className={correction.isCorrect
              ? "border-green-500 bg-green-50 dark:bg-green-950"
              : "border-red-400 bg-red-50 dark:bg-red-950"
            }>
              <CardContent className="pt-5 flex items-center gap-4">
                {correction.isCorrect ? (
                  <CheckCircle className="h-10 w-10 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-10 w-10 text-red-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg">
                    {correction.isCorrect ? "Corretto!" : "Non ancora..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Punteggio: {correction.score}/100
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Your answer */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">La tua risposta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">{studentAnswer}</p>
              </CardContent>
            </Card>

            {correction.errorTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {correction.errorTypes.map((e) => (
                  <Badge key={e} variant="destructive" className="text-xs">{e}</Badge>
                ))}
              </div>
            )}

            {/* Evaluation steps */}
            {correction.steps && correction.steps.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Correzione passo per passo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {correction.steps.map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                        s.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}>
                        {s.correct
                          ? <CheckCircle className="h-4 w-4" />
                          : <XCircle className="h-4 w-4" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-0.5">{s.label}</p>
                        <MathText text={s.comment} className="text-sm text-muted-foreground leading-relaxed" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Full solution */}
            {correction.solutionLatex && (
              <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Soluzione corretta</CardTitle>
                </CardHeader>
                <CardContent>
                  <MathText text={correction.solutionLatex} className="text-sm leading-relaxed" />
                </CardContent>
              </Card>
            )}

            {/* Interactive step review — shown only if wrong and steps exist */}
            {!correction.isCorrect && reviewSteps.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Trova dove hai sbagliato</CardTitle>
                </CardHeader>
                <CardContent>
                  {stepReviewIndex === null ? (
                    <div className="text-center py-2">
                      <p className="text-sm text-muted-foreground mb-3">
                        Rispondi passo per passo per capire dove ti sei fermato.
                      </p>
                      <Button variant="outline" onClick={startStepReview} className="gap-2">
                        <ChevronRight className="h-4 w-4" />
                        Inizia revisione
                      </Button>
                    </div>
                  ) : stepReviewIndex === -1 ? (
                    // Review complete
                    <div className="space-y-3">
                      {missedSteps.length === 0 ? (
                        <p className="text-sm text-green-700 dark:text-green-400">
                          Hai eseguito tutti i passaggi! L&apos;errore potrebbe essere un calcolo o un segno.
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">
                            Hai saltato o sbagliato {missedSteps.length === 1 ? "il passaggio" : "i passaggi"}:
                          </p>
                          <ul className="space-y-1">
                            {missedSteps.map((i) => (
                              <li key={i} className="text-sm flex gap-2 items-start">
                                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                <MathText text={reviewSteps[i - 1]} className="text-muted-foreground" />
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : (
                    // Showing a step
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Passo {stepReviewIndex + 1} di {reviewSteps.length}</span>
                        <div className="flex gap-1">
                          {reviewSteps.map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                i < stepResults.length
                                  ? stepResults[i] ? "bg-green-500" : "bg-red-400"
                                  : i === stepReviewIndex ? "bg-primary" : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <MathText text={reviewSteps[stepReviewIndex]} className="text-sm leading-relaxed" />
                      </div>
                      <p className="text-sm text-center text-muted-foreground">
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
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* What to review */}
            {correction.whatToReview.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Da ripassare
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {correction.whatToReview.map((item) => (
                      <li key={item} className="text-sm flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <MathText text={item} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommendation */}
            {recommendation ? (
              <Card className="border-violet-200 bg-violet-50 dark:bg-violet-950 dark:border-violet-800">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-violet-800 dark:text-violet-200 mb-1">
                        Consigliato per te
                      </p>
                      <p className="text-sm text-violet-700 dark:text-violet-300">
                        {recommendation.reason}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => loadExercise(recommendation.exerciseId)}
                    >
                      Fai questo esercizio
                    </Button>
                    <Button variant="outline" onClick={() => loadExercise()}>
                      Casuale
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button size="lg" className="w-full" onClick={() => loadExercise()}>
                Prossimo esercizio
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
