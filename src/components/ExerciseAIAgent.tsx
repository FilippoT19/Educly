"use client";

import { useState, useRef, useEffect } from "react";
import { MathText } from "@/components/MathText";
import { Button } from "@/components/ui/button";
import { Bot, X, Send, Loader2, Sparkles, MessageSquare } from "lucide-react";
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
  currentStepIndex?: number;
}

export function ExerciseAIAgent({
  exerciseText,
  subject,
  phase,
  steps = [],
  currentStepIndex,
}: ExerciseAIAgentProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function callAgent(action: string, extra: Record<string, unknown> = {}) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/exercise/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          exerciseText,
          subject,
          steps,
          stepIndex: currentStepIndex,
          ...extra,
        }),
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
    if (data?.solutionSteps && Array.isArray(data.solutionSteps)) {
      const formatted = (data.solutionSteps as SolutionStep[])
        .map((s) => `**Passaggio ${s.step}: ${s.title}**\n${s.text}${s.formula ? `\n$$${s.formula}$$` : ""}${s.detail ? `\n\n${s.detail}` : ""}`)
        .join("\n\n---\n\n");
      setMessages((prev) => [...prev, { role: "assistant", content: formatted }]);
    }
  }

  async function handleExplainStep() {
    const step = steps[currentStepIndex ?? 0];
    if (!step) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Spiegami il passaggio ${step.step}: ${step.title}` },
    ]);
    const data = await callAgent("explain_step");
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

  const currentStep = steps[currentStepIndex ?? -1];
  const showGenerateSteps = phase === "solving" || (phase === "solution" && steps.length === 0);
  const showExplainStep = phase === "step_review" && currentStep != null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-all bg-primary text-primary-foreground hover:bg-primary/90 ${
          open ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <Bot className="h-4 w-4" />
        Tutor AI
      </button>

      {/* Slide-up panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <div
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => setOpen(false)}
          />
          <div className="relative pointer-events-auto bg-background border-t border-border rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh]">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 shrink-0">
              <Bot className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Tutor AI</span>
              <span className="text-xs text-muted-foreground ml-1">— Ti aiuta a capire</span>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick actions */}
            {(showGenerateSteps || showExplainStep) && (
              <div className="px-4 py-3 flex gap-2 shrink-0 border-b border-border/30 flex-wrap">
                {showGenerateSteps && (
                  <button
                    onClick={handleGenerateSteps}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    Genera soluzione
                  </button>
                )}
                {showExplainStep && (
                  <button
                    onClick={handleExplainStep}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Spiegami il passaggio {currentStep.step}
                  </button>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Hai dubbi sull&apos;esercizio? Chiedi pure!
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <MathText text={m.content} className="text-sm leading-relaxed" />
                    ) : (
                      <span>{m.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border/50 shrink-0 flex gap-2">
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
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
