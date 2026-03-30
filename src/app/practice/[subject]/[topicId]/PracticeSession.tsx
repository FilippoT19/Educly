"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { MathText } from "@/components/MathText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  RefreshCw,
  Upload,
  CheckCircle,
  XCircle,
  Lightbulb,
  BookOpen,
  ChevronDown,
  ChevronUp,
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

type Phase = "idle" | "loading_exercise" | "solving" | "uploading" | "feedback";

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
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const successRate =
    stats && stats.exercises_done > 0
      ? Math.round((stats.correct / stats.exercises_done) * 100)
      : null;

  async function loadExercise() {
    setPhase("loading_exercise");
    setExercise(null);
    setCorrection(null);
    setUploadedImage(null);
    setImagePreview(null);
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
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function submitSolution() {
    if (!uploadedImage || !exercise) return;

    setPhase("uploading");
    setError("");

    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("topicId", topic.id);
    formData.append("topicName", topic.name);
    formData.append("exerciseText", exercise.text);
    formData.append("difficulty", String(exercise.difficulty));
    formData.append("image", uploadedImage);

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center gap-3">
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* START STATE */}
        {phase === "idle" && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
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
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Generazione esercizio in corso...</p>
          </div>
        )}

        {/* EXERCISE */}
        {(phase === "solving" || phase === "uploading") && exercise && (
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

            {/* Upload solution */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Carica la tua soluzione</p>
              <p className="text-xs text-muted-foreground">
                Risolvi l&apos;esercizio su GoodNotes, fai uno screenshot e caricalo qui.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

              {!imagePreview ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-muted rounded-xl py-10 flex flex-col items-center gap-2 hover:border-primary transition-colors cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Tocca per caricare l&apos;immagine</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, screenshot da GoodNotes</p>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Soluzione caricata"
                      className="w-full object-contain max-h-96"
                    />
                    <button
                      onClick={() => {
                        setUploadedImage(null);
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-xs border"
                    >
                      Cambia
                    </button>
                  </div>
                  <Button
                    onClick={submitSolution}
                    className="w-full"
                    disabled={phase === "uploading"}
                  >
                    {phase === "uploading" ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Correzione in corso...</>
                    ) : (
                      "Invia per correzione"
                    )}
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}
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

            {/* Your solution */}
            {imagePreview && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">La tua soluzione</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="La tua soluzione"
                    className="w-full object-contain rounded-lg border max-h-64"
                  />
                </CardContent>
              </Card>
            )}

            {/* Next exercise button */}
            <Button size="lg" className="w-full" onClick={loadExercise}>
              Prossimo esercizio
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
