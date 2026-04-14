"use client";

import { useState, useRef, useEffect } from "react";
import { MathText } from "@/components/MathText";
import { Button } from "@/components/ui/button";
import { Bot, Send, Loader2 } from "lucide-react";
import type { SolutionStep } from "@/lib/claude";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ExerciseAIAgentProps {
  exerciseText: string;
  subject: string;
  steps?: SolutionStep[];
  // Panel mode: always-open sidebar. Floating: bottom-right toggle button.
  mode: "panel" | "floating";
  // When set, the agent auto-sends this as a chat message
  askMessage?: string | null;
  onAskConsumed?: () => void;
}

export function ExerciseAIAgent({
  exerciseText,
  subject,
  steps = [],
  mode,
  askMessage,
  onAskConsumed,
}: ExerciseAIAgentProps) {
  const [open, setOpen] = useState(false); // only used in floating mode
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send when parent triggers an "Ask AI" action
  useEffect(() => {
    if (!askMessage) return;
    onAskConsumed?.();
    const userMsg = askMessage;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    // open panel if floating
    if (mode === "floating") setOpen(true);
    sendChat(userMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askMessage]);

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

  async function sendChat(msg: string) {
    const data = await callAgent("chat", { message: msg });
    if (data?.reply) {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    }
  }

  async function handleSendMessage() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    sendChat(msg);
  }

  const chatBody = (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
            <Bot className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">
              Clicca &quot;Ask AI&quot; su una risposta o un passaggio, oppure scrivi una domanda.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-2xl px-3 py-2 ${
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm text-xs"
                : "bg-muted text-foreground rounded-bl-sm"
            }`}>
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
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
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
    </>
  );

  // ── Panel mode: always-open inline sidebar ──────────────────────────────────
  if (mode === "panel") {
    return (
      <div className="flex flex-col h-full border-l border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 shrink-0">
          <Bot className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm">Tutor AI</span>
          <span className="ml-auto text-[10px] text-muted-foreground">10 msg/giorno</span>
        </div>
        {chatBody}
      </div>
    );
  }

  // ── Floating mode: bottom-right toggle button ────────────────────────────────
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div
          className="w-80 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "440px" }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 shrink-0 bg-muted/30">
            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-semibold text-sm">Tutor AI</span>
            <button onClick={() => setOpen(false)} className="ml-auto rounded-full p-1 hover:bg-muted transition-colors text-muted-foreground">
              ✕
            </button>
          </div>
          {chatBody}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-all bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Bot className="h-4 w-4" />
        {!open && "Tutor AI"}
      </button>
    </div>
  );
}
