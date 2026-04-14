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
  Flag,
} from "lucide-react";
import type { AnswerCheckResult, SolutionStep, AnswerComparison } from "@/lib/claude";
import type { RecommendationItem } from "@/app/api/exercise/recommend/route";
import { ExerciseAIAgent } from "@/components/ExerciseAIAgent";
import {
  trackExerciseStarted,
  trackHintRevealed,
  trackExerciseLoaded,
  trackAnswerSubmitted,
  trackCorrectionResult,
  trackRecommendationClicked,
} from "@/lib/posthog";

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
  answerOptions?: (string[] | null)[];  // null = text input, string[] = clickable choices
  hasStoredSteps?: boolean;
}

type Phase =
  | "idle"
  | "loading_exercise"
  | "solving"
  | "correcting"
  | "solution"
  | "step_review"
  | "done";

const DIFFICULTY_LABELS = ["Esempio", "Facile", "Medio", "Difficile"];
const DIFFICULTY_COLORS = ["text-blue-500", "text-green-500", "text-yellow-500", "text-red-500"];

// ── Answer comparison rows ────────────────────────────────────────────────────

function AnswerComparisonCard({
  comparisons,
  overallCorrect,
  onReport,
  onAskAI,
}: {
  comparisons: AnswerComparison[];
  overallCorrect: boolean;
  onReport: () => void;
  onAskAI?: (msg: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${
        overallCorrect ? "bg-green-500/10" : "bg-red-500/10"
      }`}>
        <div className="flex items-center gap-2">
          {overallCorrect
            ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
          <p className="text-sm font-semibold">
            {overallCorrect ? "Risposta corretta" : "Risposta sbagliata"}
          </p>
        </div>
        <button
          onClick={onReport}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Flag className="h-3 w-3" />
          Segnala errore
        </button>
      </div>

      {/* One row per answer part */}
      <div className="divide-y divide-border/50">
        {comparisons.map((c, i) => (
          <div key={i} className="px-4 py-3 space-y-2">
            {comparisons.length > 1 && (
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{c.label}</p>
            )}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground mb-0.5">La tua risposta</p>
                <p className="font-mono text-sm break-all">{c.studentAnswer || "—"}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground mb-0.5">Risposta corretta</p>
                <MathText text={c.correctAnswer} className="text-sm font-medium" />
              </div>
              <div className="shrink-0 mt-4">
                {c.isCorrect
                  ? <CheckCircle className="h-4 w-4 text-green-500" />
                  : <XCircle className="h-4 w-4 text-red-400" />}
              </div>
            </div>
            {onAskAI && (
              <button
                onClick={() => onAskAI(
                  comparisons.length > 1
                    ? `Spiegami la risposta "${c.label}": la risposta corretta è ${c.correctAnswer}. La mia era "${c.studentAnswer}". Perché?`
                    : `Spiegami la risposta corretta: ${c.correctAnswer}. La mia risposta era "${c.studentAnswer}". Perché è ${c.isCorrect ? "giusta" : "sbagliata"}?`
                )}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <BookOpen className="h-3 w-3" />
                Ask AI
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Report modal ──────────────────────────────────────────────────────────────

function ReportModal({
  onClose,
  onSubmit,
  appAnswer,
}: {
  onClose: () => void;
  onSubmit: (reportedAnswer: string) => void;
  appAnswer: string;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-5 w-full max-w-sm space-y-4">
        <p className="font-semibold text-sm">Segnala correzione errata</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          L&apos;app ha segnato questa risposta come sbagliata ma pensi fosse corretta? Inserisci (opzionalmente) la risposta corretta e invia la segnalazione.
        </p>
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">Risposta segnata dall&apos;app: <span className="font-mono">{appAnswer}</span></p>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="La risposta corretta (opzionale)"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Annulla</Button>
          <Button size="sm" className="flex-1" onClick={() => onSubmit(value)}>Invia segnalazione</Button>
        </div>
      </div>
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step, verdict, isCurrent, onYes, onNo, onAskAI,
}: {
  step: SolutionStep;
  verdict: boolean | null;
  isCurrent: boolean;
  onYes?: () => void;
  onNo?: () => void;
  onAskAI?: (msg: string) => void;
}) {
  return (
    <div className={`rounded-2xl border transition-all ${
      verdict === true ? "border-green-500/30 bg-green-500/5"
      : verdict === false ? "border-red-500/30 bg-red-500/5"
      : isCurrent ? "border-primary/40 bg-primary/5"
      : "border-border/50 bg-card"
    }`}>
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
          verdict === true ? "bg-green-500/20 text-green-400"
          : verdict === false ? "bg-red-500/20 text-red-400"
          : isCurrent ? "bg-primary/20 text-primary"
          : "bg-muted text-muted-foreground"
        }`}>
          {verdict === true ? <CheckCircle className="h-3.5 w-3.5" />
          : verdict === false ? <XCircle className="h-3.5 w-3.5" />
          : step.step}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm leading-snug">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{step.text}</p>
            </div>
            {onAskAI && (
              <button
                onClick={() => onAskAI(`Spiegami il passaggio ${step.step}: "${step.title}". ${step.text}`)}
                className="shrink-0 flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <BookOpen className="h-3 w-3" />
                Ask AI
              </button>
            )}
          </div>
        </div>
      </div>
      {step.formula && (
        <div className="px-4 pb-3">
          <MathText text={`$$${step.formula}$$`} className="text-center" />
        </div>
      )}
      {isCurrent && verdict === null && (
        <div className="mx-4 mb-4 border-t border-border/40 pt-3">
          <p className="text-xs text-center text-muted-foreground mb-3">
            Hai eseguito questo passaggio correttamente?
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20" variant="ghost" onClick={onYes}>
              Sì, l&apos;ho fatto
            </Button>
            <Button size="sm" className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20" variant="ghost" onClick={onNo}>
              No, non l&apos;ho fatto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Solution accordion ────────────────────────────────────────────────────────

function SolutionAccordion({ step, missed, onAskAI }: { step: SolutionStep; missed: boolean; onAskAI?: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border ${missed ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card"}`}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2">
            {missed
              ? <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              : <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />}
            <p className="font-semibold text-sm">{step.title}</p>
          </div>
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Spiegami il passaggio ${step.step}: "${step.title}". ${step.text}`)}
              className="shrink-0 flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <BookOpen className="h-3 w-3" />
              Ask AI
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{step.text}</p>
      </div>
      {step.formula && (
        <div className="px-4 pb-2">
          <MathText text={`$$${step.formula}$$`} className="text-center" />
        </div>
      )}
      {step.detail && (
        <div className="border-t border-border/40">
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
    <div className={`rounded-2xl border ${
      rec.isTop
        ? "border-primary/30 bg-primary/5"
        : "border-border/50 bg-card"
    }`}>
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          {rec.isTop && (
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Consigliato
              </span>
            </div>
          )}
          <Badge variant="outline" className={`text-[10px] ml-auto ${DIFFICULTY_COLORS[rec.difficulty] ?? ""}`}>
            {DIFFICULTY_LABELS[rec.difficulty] ?? ""}
          </Badge>
        </div>
        <div className={`text-xs leading-snug text-foreground/70 ${expanded ? "" : "line-clamp-3"}`}>
          <MathText text={rec.questionPreview} className="text-xs" />
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors border-t border-border/30"
      >
        <span>{expanded ? "Comprimi" : "Vedi tutto"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className="px-4 pb-4 pt-2">
        <Button
          size="sm"
          className="w-full"
          variant={rec.isTop ? "default" : "outline"}
          onClick={onStart}
        >
          Inizia
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [selfCheckPending, setSelfCheckPending] = useState(false);
  const [askMessage, setAskMessage] = useState<string | null>(null);

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
    setSelfCheckPending(false);
    setStudentAnswers([""]);
    setActiveAnswerIdx(0);
    setShowHints(false);
    setHintsUsed(false);
    setError("");
    setCheckResult(null);
    setStepIndex(0);
    setStepAnswers([]);
    setFinalScore(null);
    setReportSent(false);
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
    setExercise({ ...data, hasStoredSteps: (data.solutionSteps || []).length > 0 });
    trackExerciseLoaded({ subject, topicId: topic.id, difficulty: data.difficulty, fromDb: data.fromDb ?? false });
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
    trackAnswerSubmitted({ subject, topicId: topic.id, exerciseId: currentExerciseId ?? undefined });

    const res = await fetch("/api/exercise/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        topicName: topic.name,
        exerciseText: exercise.text,
        studentAnswer: combinedAnswer,
        studentAnswers: studentAnswers.map(s => s.trim()),
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

    if (result.selfCheck) {
      // Self-check: show solution, let student self-report
      setPhase("solution");
      setSelfCheckPending(true);
      return;
    }

    if (result.isCorrect) {
      const score = hintsUsed ? 70 : 100;
      setFinalScore(score);
      setPhase("solution");
      trackCorrectionResult({ subject, topicId: topic.id, isCorrect: true, score, usedDb: false });
      saveResult(result, score);
      fetchRecommendations(score);
    } else if (result.solutionSteps.length > 0) {
      // Wrong answer + steps available → step review
      trackCorrectionResult({ subject, topicId: topic.id, isCorrect: false, score: 0, usedDb: false });
      setStepIndex(0);
      setStepAnswers([]);
      setPhase("step_review");
    } else {
      // Wrong answer but no steps (non-starred) → show comparison directly
      setFinalScore(0);
      setPhase("solution");
      trackCorrectionResult({ subject, topicId: topic.id, isCorrect: false, score: 0, usedDb: false });
      saveResult(result, 0);
      fetchRecommendations(0);
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
    const stepsArr = checkResult.solutionSteps;
    const newAnswers = [...stepAnswers, correct];
    setStepAnswers(newAnswers);

    if (stepIndex < stepsArr.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      const earnedWeight = stepsArr.reduce((sum, s, i) => sum + (newAnswers[i] ? s.weight : 0), 0);
      const score = Math.min(earnedWeight, 75);
      setFinalScore(score);
      setPhase("done");
      saveResult(checkResult, score);
      fetchRecommendations(score);
    }
  }

  async function sendReport(reportedAnswer: string) {
    setShowReportModal(false);
    setReportSent(true);

    // Void the result: prevent saving if not yet saved, undo if already saved
    const wasCorrect = checkResult?.isCorrect ?? false;
    if (savedRef.current) {
      // Already saved — undo it
      fetch("/api/exercise/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: currentExerciseId,
          subject,
          topicId: topic.id,
          wasCorrect,
        }),
      }).catch(() => {});
    } else {
      // Not yet saved — block saving
      savedRef.current = true;
    }

    // Send report to admin
    fetch("/api/exercise/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: currentExerciseId,
        subject,
        topicId: topic.id,
        studentAnswer: combinedAnswer,
        appAnswer: checkResult?.correctAnswer ?? "",
        reportedCorrectAnswer: reportedAnswer || null,
      }),
    }).catch(() => {});
  }

  const steps: SolutionStep[] = checkResult?.solutionSteps ?? [];

  const partialScore = steps.slice(0, stepAnswers.length).reduce(
    (sum, s, i) => sum + (stepAnswers[i] ? s.weight : 0), 0
  );

  // Build answer comparisons for display
  const answerComparisons: AnswerComparison[] = checkResult?.answerComparisons ?? (
    checkResult ? [{
      label: "Risultato",
      studentAnswer: combinedAnswer,
      correctAnswer: checkResult.correctAnswer,
      isCorrect: checkResult.isCorrect,
    }] : []
  );

  // ── Shared UI blocks ──────────────────────────────────────────────────────

  const ScoreCard = ({ score, label, color }: { score: number; label: string; color: "green" | "orange" }) => (
    <div className={`rounded-2xl border p-5 text-center ${
      color === "green"
        ? "border-green-500/30 bg-green-500/5"
        : "border-orange-500/30 bg-orange-500/5"
    }`}>
      <p className={`text-5xl font-bold tracking-tight ${color === "green" ? "text-green-400" : "text-orange-400"}`}>
        {score}
      </p>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
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
              onStart={() => { trackRecommendationClicked({ exerciseId: rec.exerciseId, isTop: rec.isTop }); loadExercise(rec.exerciseId); }}
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
    <header className="border-b border-border/50 px-4 py-3 flex items-center gap-3 shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <Link
        href={backHref ?? `/course/${subject}`}
        className="inline-flex items-center justify-center rounded-xl size-8 hover:bg-white/5 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{subjectName}</p>
        <h1 className="font-semibold text-[15px] leading-tight">{topic.name}</h1>
      </div>
      {stats && (
        <div className="text-right text-sm">
          <p className="font-semibold">{stats.exercises_done}</p>
          {successRate !== null && (
            <p className="text-[11px] text-muted-foreground">{successRate}%</p>
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
              <Button size="lg" onClick={() => { trackExerciseStarted({ subject, topicId: topic.id }); loadExercise(); }}>Inizia</Button>
            </div>
          )}

          {phase === "loading_exercise" && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Caricamento esercizio...</p>
            </div>
          )}

          {exercise && (phase === "solving" || phase === "correcting") && (
            <ExerciseAIAgent
              exerciseText={exercise.text}
              subject={subject}
              steps={[]}
              mode="floating"
            />
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
                      onClick={() => { setShowHints(true); setHintsUsed(true); trackHintRevealed({ subject, topicId: topic.id }); }}
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
              {(() => {
                const labels = getAnswerLabels(exercise);
                const opts = exercise.answerOptions ?? [];
                const hasAnyTextInput = opts.some(o => !o) || opts.length === 0;
                return (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {studentAnswers.length > 1 ? "Le tue risposte" : "Risultato finale"}
                    </p>

                    <div className="space-y-4">
                      {studentAnswers.map((val, i) => {
                        const choices = opts[i] ?? null;
                        return (
                          <div key={i} className="space-y-2">
                            {(studentAnswers.length > 1 || choices) && (
                              <p className="text-xs font-semibold text-muted-foreground px-1">
                                {labels[i]}
                              </p>
                            )}
                            {choices ? (
                              /* Choice buttons */
                              <div className={`flex gap-2 flex-wrap`}>
                                {choices.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    disabled={phase === "correcting"}
                                    onClick={() => setStudentAnswers(prev => {
                                      const next = [...prev];
                                      next[i] = opt;
                                      return next;
                                    })}
                                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                      val === opt
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background border-input text-foreground hover:border-primary/60 hover:bg-primary/5"
                                    } disabled:opacity-60`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              /* Text input */
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
                                placeholder={studentAnswers.length === 1 ? "Es: 3/4, pi/2, sqrt(2)…" : `Inserisci ${labels[i]}`}
                                disabled={phase === "correcting"}
                                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 font-mono"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Math keyboard — only when at least one text input exists */}
                    {hasAnyTextInput && (
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
                    )}
                  </div>
                );
              })()}

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

  // ── SOLUTION / STEP_REVIEW / DONE — full-height layout with AI panel ────────

  const isCorrect = checkResult?.isCorrect ?? false;

  const phaseLabel =
    phase === "solution" ? (selfCheckPending ? "Soluzione" : "Correzione")
    : phase === "step_review" ? "Revisione passaggi"
    : phase === "done" ? "Soluzione"
    : "";

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header with phase label */}
      <header className="border-b border-border/50 px-4 py-3 flex items-center gap-3 shrink-0 bg-background/80 backdrop-blur-sm z-10">
        <Link
          href={backHref ?? `/course/${subject}`}
          className="inline-flex items-center justify-center rounded-xl size-8 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{subjectName}</p>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-[15px] leading-tight truncate">{topic.name}</h1>
            {phaseLabel && (
              <Badge variant="outline" className="text-[10px] shrink-0">{phaseLabel}</Badge>
            )}
          </div>
        </div>
        {stats && (
          <div className="text-right text-sm shrink-0">
            <p className="font-semibold">{stats.exercises_done}</p>
            {successRate !== null && (
              <p className="text-[11px] text-muted-foreground">{successRate}%</p>
            )}
          </div>
        )}
      </header>

      {/* Report modal */}
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onSubmit={sendReport}
          appAnswer={checkResult?.correctAnswer ?? ""}
        />
      )}

      {/* Two-column body: left scrolls, right = AI panel */}
      <div className="flex-1 min-h-0 flex">

        {/* LEFT — scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Exercise recap */}
            <ExerciseRecap />

            {/* Self-check: show full solution for student to compare */}
            {selfCheckPending && checkResult && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Soluzione</p>
                </div>
                <div className="px-4 py-3">
                  <MathText text={checkResult.correctAnswer} className="text-sm leading-relaxed" />
                </div>
              </div>
            )}

            {/* Self-check yes/no */}
            {phase === "solution" && selfCheckPending && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-center">Hai risposto correttamente?</p>
                <p className="text-xs text-muted-foreground text-center">Confronta la tua risposta con quella mostrata</p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20"
                    variant="ghost"
                    onClick={() => {
                      const score = hintsUsed ? 70 : 100;
                      setFinalScore(score);
                      setSelfCheckPending(false);
                      if (checkResult) {
                        const result = { ...checkResult, isCorrect: true };
                        setCheckResult(result);
                        trackCorrectionResult({ subject, topicId: topic.id, isCorrect: true, score, usedDb: false });
                        saveResult(result, score);
                        fetchRecommendations(score);
                      }
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" /> Sì
                  </Button>
                  <Button
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                    variant="ghost"
                    onClick={() => {
                      setFinalScore(0);
                      setSelfCheckPending(false);
                      if (checkResult) {
                        const result = { ...checkResult, isCorrect: false };
                        setCheckResult(result);
                        trackCorrectionResult({ subject, topicId: topic.id, isCorrect: false, score: 0, usedDb: false });
                        saveResult(result, 0);
                        fetchRecommendations(0);
                      }
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" /> No
                  </Button>
                </div>
              </div>
            )}

            {/* Answer comparison rows */}
            {checkResult && !selfCheckPending && (
              <div className="space-y-1">
                <AnswerComparisonCard
                  comparisons={answerComparisons}
                  overallCorrect={isCorrect}
                  onReport={() => setShowReportModal(true)}
                  onAskAI={setAskMessage}
                />
                {reportSent && (
                  <p className="text-xs text-muted-foreground px-1">
                    Risultato annullato. Segnalazione inviata.
                  </p>
                )}
              </div>
            )}

            {/* Score badge (inline, compact) */}
            {(phase === "solution" && !selfCheckPending) && finalScore !== null && (
              <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${
                isCorrect ? "border-green-500/30 bg-green-500/5" : "border-orange-500/30 bg-orange-500/5"
              }`}>
                <span className="text-xs text-muted-foreground">
                  {isCorrect && hintsUsed ? "Punti (suggerimenti usati)" : "Punteggio"}
                </span>
                <span className={`text-xl font-bold ${isCorrect ? "text-green-400" : "text-orange-400"}`}>
                  {finalScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                </span>
              </div>
            )}

            {/* Step-by-step review progress */}
            {phase === "step_review" && (
              <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso</span>
                  <span>{stepIndex + 1} / {steps.length} — parziale: <span className="font-semibold text-foreground">{partialScore}</span> / 75</span>
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
              </div>
            )}

            {/* Step cards */}
            {phase === "step_review" && checkResult && (
              <div className="space-y-3">
                {steps.slice(0, stepIndex + 1).map((s, i) => (
                  <StepCard
                    key={s.step}
                    step={s}
                    verdict={i < stepAnswers.length ? stepAnswers[i] : null}
                    isCurrent={i === stepIndex}
                    onYes={() => answerStep(true)}
                    onNo={() => answerStep(false)}
                    onAskAI={setAskMessage}
                  />
                ))}
              </div>
            )}

            {/* Solution accordion (correct or after step review) */}
            {(phase === "solution" || phase === "done") && steps.length > 0 && (
              <div className="space-y-3">
                <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Soluzione passo-passo
                </p>
                {steps.map((s, i) => (
                  <SolutionAccordion
                    key={s.step}
                    step={s}
                    missed={phase === "done" && stepAnswers[i] === false}
                    onAskAI={setAskMessage}
                  />
                ))}
              </div>
            )}

            {/* Score + recommendations after step review done */}
            {phase === "done" && finalScore !== null && (
              <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 border border-orange-500/30 bg-orange-500/5`}>
                <span className="text-xs text-muted-foreground">Punteggio finale</span>
                <span className="text-xl font-bold text-orange-400">
                  {finalScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                </span>
              </div>
            )}

            {((phase === "solution" && !selfCheckPending) || phase === "done") && (
              <RecommendationSection />
            )}
          </div>
        </div>

        {/* RIGHT — always-open AI panel */}
        <div className="w-80 shrink-0 hidden md:flex flex-col">
          <ExerciseAIAgent
            exerciseText={exercise?.text ?? ""}
            subject={subject}
            steps={steps}
            mode="panel"
            askMessage={askMessage}
            onAskConsumed={() => setAskMessage(null)}
          />
        </div>
      </div>
    </div>
  );
}
