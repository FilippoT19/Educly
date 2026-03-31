"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { MathText } from "@/components/MathText";
import { DrawingCanvas, DrawingCanvasRef } from "@/components/DrawingCanvas";
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
  ChevronDown,
  ChevronUp,
  Trash2,
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
  text: string;
  difficulty: number;
  hints: string[];
}

interface Correction {
  isCorrect: boolean;
  score: number;
  errorTypes: string[];
  feedback: string;
  whatToReview: string[];
}

type Phase = "idle" | "loading_exercise" | "solving" | "correcting" | "feedback";

const DIFFICULTY_LABELS = ["", "Facile", "Medio", "Difficile"];
const DIFFICULTY_COLORS = ["", "text-green-600", "text-yellow-600", "text-red-600"];

export function PracticeSession({
  subject,
  subjectName,
  topic,
  stats,
}: {
  subject: string;
  subjectName: string;
  topic: Topic;
  stats: TopicStats | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [canvasSnapshot, setCanvasSnapshot] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<DrawingCanvasRef>(null);

  const successRate =
    stats && stats.exercises_done > 0
      ? Math.round((stats.correct / stats.exercises_done) * 100)
      : null;

  async function loadExercise() {
    setPhase("loading_exercise");
    setExercise(null);
    setCorrection(null);
    setCanvasSnapshot(null);
    setShowHints(false);
    setError("");

    const res = await fetch("/api/exercise/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, topicId: topic.id }),
    });

    if (!res.ok) {
      setError("Errore nel caricare l'esercizio. Riprova.");
      setPhase("idle");
      return;
    }

    const data = await res.json();
    setExercise(data);
    setPhase("solving");
    // Clear canvas for new exercise
    setTimeout(() => canvasRef.current?.clear(), 50);
  }

  async function submitSolution() {
    if (!exercise || !canvasRef.current) return;

    if (canvasRef.current.isEmpty()) {
      setError("Scrivi la soluzione prima di inviare.");
      return;
    }

    setError("");
    setPhase("correcting");

    // Export canvas as PNG blob
    const blob = await canvasRef.current.exportPng();
    if (!blob) {
      setError("Errore nell'esportazione del disegno. Riprova.");
      setPhase("solving");
      return;
    }

    // Save snapshot for display in feedback
    const reader = new FileReader();
    reader.onload = (ev) => setCanvasSnapshot(ev.target?.result as string);
    reader.readAsDataURL(blob);

    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("topicId", topic.id);
    formData.append("topicName", topic.name);
    formData.append("exerciseText", exercise.text);
    formData.append("difficulty", String(exercise.difficulty));
    formData.append("image", blob, "solution.png");

    const res = await fetch("/api/exercise/correct", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setError("Errore nella correzione. Riprova.");
      setPhase("solving");
      return;
    }

    const data = await res.json();
    setCorrection(data);
    setPhase("feedback");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
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
            <Button size="lg" onClick={loadExercise}>
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

        {/* EXERCISE + CANVAS */}
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
              <button
                onClick={() => setShowHints(!showHints)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Lightbulb className="h-4 w-4" />
                {showHints ? "Nascondi suggerimenti" : "Mostra suggerimenti"}
                {showHints ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
            {showHints && (
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
            )}

            <Separator />

            {/* Drawing canvas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">La tua soluzione</p>
                <button
                  onClick={() => canvasRef.current?.clear()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Cancella tutto
                </button>
              </div>
              <DrawingCanvas
                ref={canvasRef}
                className="w-full rounded-xl border bg-white"
                style={{ height: "360px" }}
              />
              <p className="text-xs text-muted-foreground text-center">
                Scrivi con Apple Pencil · Il dito non disegna
              </p>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button
              size="lg"
              className="w-full"
              onClick={submitSolution}
              disabled={phase === "correcting"}
            >
              {phase === "correcting" ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Correzione in corso...</>
              ) : (
                "Invia per correzione"
              )}
            </Button>
          </>
        )}

        {/* FEEDBACK */}
        {phase === "feedback" && correction && exercise && (
          <>
            {/* Result banner */}
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
                <div>
                  <p className="font-semibold text-lg">
                    {correction.isCorrect ? "Corretto!" : "Non ancora..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Punteggio: {correction.score}/100
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Error types */}
            {correction.errorTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {correction.errorTypes.map((e) => (
                  <Badge key={e} variant="destructive" className="text-xs">
                    {e}
                  </Badge>
                ))}
              </div>
            )}

            {/* AI Feedback */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Correzione dettagliata</CardTitle>
              </CardHeader>
              <CardContent>
                <MathText text={correction.feedback} className="text-sm leading-relaxed" />
              </CardContent>
            </Card>

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
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Snapshot of solution */}
            {canvasSnapshot && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">La tua soluzione</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={canvasSnapshot}
                    alt="La tua soluzione"
                    className="w-full object-contain rounded-lg border max-h-64"
                  />
                </CardContent>
              </Card>
            )}

            <Button size="lg" className="w-full" onClick={loadExercise}>
              Prossimo esercizio
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
