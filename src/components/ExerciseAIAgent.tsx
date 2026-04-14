"use client";

import { useState, useRef, useEffect } from "react";
import { MathText } from "@/components/MathText";
import { Button } from "@/components/ui/button";
import { Bot, X, Send, Loader2, Sparkles, ChevronRight } from "lucide-react";
import type { SolutionStep } from "@/lib/claude";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ExerciseAIAgentProps {
  exerciseText: string;
  subject: string;
  phase: string;
  steps?: SolutionStep[];
  hasStoredSteps?: boolean;
}

export function ExerciseAIAgent({
  exerciseText,
  subject,
  phase,
  steps = [],
  hasStoredSteps = false,
}: ExerciseAIAgentProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showStepPicker, setShowStepPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPostCorrection = phase === "solution" || phase === "step_review" || phase === "done";
  const showGenerateSteps = isPostCorrection && !hasStoredSteps;
  const showExplainStep = isPostCorrection && steps.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset step picker when panel closes
  useEffect(() => {
    if (!open) setShowStepPicker(false);
  }, [open]);

  async function callAgent(action: string, extra: Record<string, unknown> = {}) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/exercise/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, exerciseText, subject, steps, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateSteps() {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Genera la soluzione passo-passo per questo esercizio." },
    ]);
    const data = await callAgent("generate_steps");
    if (data?.solutionSteps) {
      const formatted = (data.solutionSteps as SolutionStep[])
        .map((s) =>
          `**Passaggio ${s.step}: ${s.title}**\n${s.text}${s.formula ? `\n$$${s.formula}$$` : ""}${s.detail ? `\n\n${s.detail}` : ""}`
        )
        .join("\n\n---\n\n");
      setMessages((prev) => [...prev, { role: "assistant", content: formatted }]);
    }
  }

  async function handleExplainStep(stepIdx: number) {
    setShowStepPicker(false);
    const step = steps[stepIdx];
    if (!step) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Spiegami il passaggio ${step.step}: ${step.title}` },
    ]);
    const data = await callAgent("explain_step", { stepIndex: stepIdx });
    if (data?.explanation) {
      setMessages((prev) => [...prev, { role: "assistant", content: data.explanation }]);
    }
  }

  async function handleSendMessage() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    const data = await callAgent("chat", { message: msg });
    if (data?.reply) {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Panel */}
      {open && (
        <div className="w-80 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "460px" }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 shrink-0 bg-muted/30">
            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-semibold text-sm">Tutor AI</span>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto rounded-full p-1 hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Quick actions */}
          {(showGenerateSteps || showExplainStep) && (
            <div className="px-3 py-2 flex gap-2 shrink-0 border-b border-border/30 flex-wrap">
              {showGenerateSteps && (
                <button
                  onClick={handleGenerateSteps}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Genera soluzione
                </button>
              )}
              {showExplainStep && (
                <button
                  onClick={() => setShowStepPicker((v) => !v)}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Spiegami un passaggio
                  <ChevronRight className={`h-3 w-3 transition-transform ${showStepPicker ? "rotate-90" : ""}`} />
                </button>
              )}
            </div>
          )}

          {/* Step picker */}
          {showStepPicker && steps.length > 0 && (
            <div className="px-3 py-2 border-b border-border/30 space-y-1 shrink-0 bg-muted/20">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Seleziona il passaggio
              </p>
              {steps.map((s, i) => (
                <button
                  key={s.step}
                  onClick={() => handleExplainStep(i)}
                  disabled={loading}
                  className="w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {s.step}
                  </span>
                  <span className="leading-snug">{s.title}</span>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 leading-relaxed">
                Hai dubbi? Chiedi qualsiasi cosa sull&apos;esercizio.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <MathText text={m.content} className="text-xs leading-relaxed" />
                  ) : (
                    <span className="text-xs">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {error && <p className="text-[11px] text-destructive text-center">{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-border/50 shrink-0 flex gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Fai una domanda..."
              disabled={loading}
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-all bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {open ? <X className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        {!open && "Tutor AI"}
      </button>
    </div>
  );
}
