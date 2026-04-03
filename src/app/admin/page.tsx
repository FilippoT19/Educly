"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload, CheckCircle, AlertCircle, Loader2,
  BookOpen, PenLine, Eye, Pencil, Trash2, Save, X, Plus,
  Library, ChevronRight, ArrowLeft, BookMarked, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/MathText";

// ── Types ──────────────────────────────────────────────────────────────────────
type Status = "idle" | "uploading" | "processing" | "done" | "error";

interface SourceDocument {
  id: string;
  title: string;
  subject: string;
  doc_type: string;
  engineering: string;
  section: string;
}

interface ProcessedEntry {
  chapterTitle: string;
  extracted: number;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { id: "analisi1", name: "Analisi 1" },
  { id: "analisi2", name: "Analisi 2" },
];

const ENGINEERING_OPTIONS = [
  "tutti", "Ingegneria Fisica", "Ingegneria Informatica", "Ingegneria Meccanica",
  "Ingegneria Civile", "Ingegneria Elettronica", "Ingegneria Energetica",
  "Ingegneria Aerospaziale", "Ingegneria Biomedica", "Ingegneria Matematica",
];

const SECTIONS = ["tutti", "AM", "MZ", "A", "B", "C", "D"];
const EXERCISE_SOURCES = [
  { id: "eserciziario", name: "Eserciziario" },
  { id: "tema_passato", name: "Tema d'esame passato" },
  { id: "dispensa", name: "Dispensa con esercizi" },
];
const DIFFICULTY_LABELS: Record<number, string> = { 1: "Facile", 2: "Medio", 3: "Difficile" };

const DOC_TYPE_LABELS: Record<string, string> = {
  libro_teoria: "Teoria",
  eserciziario: "Esercizi",
  tema_passato: "Temi d'esame",
  dispensa: "Dispensa",
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NativeSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

function FilePickerRow({ file, onChange, disabled, accept = ".pdf" }: {
  file: File | null; onChange: (f: File | null) => void; disabled?: boolean; accept?: string;
}) {
  const isLatex = file?.name.endsWith(".tex");
  const label = accept === ".pdf,.tex" ? "Seleziona PDF o LaTeX (.tex)…" : accept === ".tex" ? "Seleziona file LaTeX (.tex)…" : "Seleziona PDF…";
  return (
    <label className={cn(
      "flex items-center gap-2.5 px-3 py-2.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-sm",
      disabled ? "opacity-50 cursor-not-allowed" : "",
      file ? "border-primary bg-primary/5 text-primary" : "border-muted hover:border-primary/40 hover:bg-muted/20 text-muted-foreground"
    )}>
      <input type="file" accept={accept} className="hidden" disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] || null)} />
      <Upload className="h-4 w-4 shrink-0" />
      {file ? (
        <span className="truncate font-medium">
          {file.name}{" "}
          <span className="font-normal opacity-60">
            {isLatex ? `(${(file.size / 1024).toFixed(0)} KB)` : `(${(file.size / 1024 / 1024).toFixed(1)} MB)`}
          </span>
        </span>
      ) : (
        <span>{label}</span>
      )}
    </label>
  );
}

function StatusBanner({ status, message }: { status: Status; message?: string }) {
  if (status === "idle") return null;
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border text-sm",
      status === "processing" || status === "uploading"
        ? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
        : status === "done"
        ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
        : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
    )}>
      {(status === "processing" || status === "uploading") && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      {status === "done" && <CheckCircle className="h-4 w-4 shrink-0" />}
      {status === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
      <span>
        {status === "uploading" && "Caricamento file…"}
        {status === "processing" && "Claude sta analizzando il PDF — 1–3 minuti…"}
        {status === "done" && (message || "Completato!")}
        {status === "error" && (message || "Errore durante il processing.")}
      </span>
    </div>
  );
}

// ── Resource card ─────────────────────────────────────────────────────────────
function ResourceCard({ resource, onClick }: { resource: SourceDocument; onClick: () => void }) {
  const icon = resource.doc_type === "libro_teoria"
    ? <BookMarked className="h-5 w-5" />
    : <FolderOpen className="h-5 w-5" />;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group rounded-2xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="p-2 rounded-xl bg-primary/8 text-primary">{icon}</div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
      </div>
      <div>
        <p className="font-semibold text-sm leading-snug line-clamp-2">{resource.title}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="secondary" className="text-xs">{resource.subject}</Badge>
          <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[resource.doc_type] ?? resource.doc_type}</Badge>
          {resource.engineering !== "tutti" && (
            <Badge variant="outline" className="text-xs truncate max-w-[140px]">{resource.engineering}</Badge>
          )}
          {resource.section !== "tutti" && (
            <Badge variant="outline" className="text-xs">Scaglione {resource.section}</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Exercise editor ───────────────────────────────────────────────────────────
interface Exercise {
  id: string; topic_id: string; difficulty: number; source: string;
  question_latex: string; solution_latex: string; hints: string[];
  engineering: string; section: string;
}

function ExerciseCard({ ex, secret, onDelete }: { ex: Exercise; secret: string; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(ex);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/exercises/${form.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify(form),
    });
    setSaving(false); setEditing(false);
  }

  async function del() {
    if (!confirm("Eliminare questo esercizio?")) return;
    await fetch(`/api/admin/exercises/${ex.id}`, { method: "DELETE", headers: { "x-admin-secret": secret } });
    onDelete(ex.id);
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{ex.topic_id.replace(/_/g, " ")}</Badge>
          <Badge variant="secondary">{DIFFICULTY_LABELS[ex.difficulty]}</Badge>
          <Badge variant="outline" className="text-xs">{ex.source}</Badge>
          {ex.engineering !== "tutti" && <Badge variant="outline" className="text-xs">{ex.engineering}</Badge>}
          {ex.section !== "tutti" && <Badge variant="outline" className="text-xs">Scaglione {ex.section}</Badge>}
          <div className="ml-auto flex gap-1">
            <button onClick={() => setEditing(!editing)} className="p-1.5 rounded hover:bg-muted">
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
            <button onClick={del} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        {editing ? (
          <div className="space-y-3">
            <Field label="Domanda (LaTeX)">
              <textarea className="w-full border rounded-md px-3 py-2 text-sm font-mono min-h-24 resize-y"
                value={form.question_latex} onChange={(e) => setForm({ ...form, question_latex: e.target.value })} />
            </Field>
            <Field label="Soluzione (LaTeX)">
              <textarea className="w-full border rounded-md px-3 py-2 text-sm font-mono min-h-32 resize-y"
                value={form.solution_latex} onChange={(e) => setForm({ ...form, solution_latex: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Difficoltà">
                <NativeSelect value={String(form.difficulty)} onChange={(v) => setForm({ ...form, difficulty: parseInt(v) })}
                  options={[{ id: "1", name: "Facile" }, { id: "2", name: "Medio" }, { id: "3", name: "Difficile" }]} />
              </Field>
              <Field label="Ingegneria">
                <NativeSelect value={form.engineering} onChange={(v) => setForm({ ...form, engineering: v })}
                  options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
              </Field>
            </div>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Salva
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Domanda</p>
              <MathText text={ex.question_latex} className="text-sm" />
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Soluzione</p>
              <MathText text={ex.solution_latex} className="text-sm" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const uid = useId();
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // ── Nav ────────────────────────────────────────────────────────────────────
  type Page = "library" | "exercises" | "theory" | "review";
  const [page, setPage] = useState<Page>("library");

  // ── Library ────────────────────────────────────────────────────────────────
  const [books, setBooks] = useState<SourceDocument[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [detailBook, setDetailBook] = useState<SourceDocument | null>(null);

  // Add resource form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("analisi1");
  const [newDocType, setNewDocType] = useState("libro_teoria");
  const [newEngineering, setNewEngineering] = useState("tutti");
  const [newSection, setNewSection] = useState("tutti");
  const [creatingBook, setCreatingBook] = useState(false);
  const [createError, setCreateError] = useState("");

  // Chapter upload (detail view)
  const [chTitle, setChTitle] = useState("");
  const [chIndex, setChIndex] = useState("");
  const [chTotal, setChTotal] = useState("");
  const [chFile, setChFile] = useState<File | null>(null);
  const [chStatus, setChStatus] = useState<Status>("idle");
  const [chMsg, setChMsg] = useState("");
  const [processed, setProcessed] = useState<ProcessedEntry[]>([]);

  // ── Exercise tab ───────────────────────────────────────────────────────────
  const [exFile, setExFile] = useState<File | null>(null);
  const [exSubject, setExSubject] = useState("analisi1");
  const [exSource, setExSource] = useState("eserciziario");
  const [exTitle, setExTitle] = useState("");
  const [exYear, setExYear] = useState("");
  const [exEngineering, setExEngineering] = useState("tutti");
  const [exSection, setExSection] = useState("tutti");
  const [exStatus, setExStatus] = useState<Status>("idle");
  const [exMsg, setExMsg] = useState("");

  // ── Theory tab ─────────────────────────────────────────────────────────────
  const [thFile, setThFile] = useState<File | null>(null);
  const [thSubject, setThSubject] = useState("analisi1");
  const [thTitle, setThTitle] = useState("");
  const [thEngineering, setThEngineering] = useState("tutti");
  const [thSection, setThSection] = useState("tutti");
  const [thStatus, setThStatus] = useState<Status>("idle");
  const [thMsg, setThMsg] = useState("");

  // ── Review tab ─────────────────────────────────────────────────────────────
  const [reviewSubject, setReviewSubject] = useState("analisi1");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  // ── Auth ───────────────────────────────────────────────────────────────────
  async function handleLogin() {
    setAuthLoading(true); setAuthError(false);
    const res = await fetch("/api/admin/books", { headers: { "x-admin-secret": secret } });
    setAuthLoading(false);
    if (res.status === 401) { setAuthError(true); return; }
    const data = await res.json();
    setBooks(data.books || []);
    setAuthenticated(true);
  }

  // ── Library helpers ────────────────────────────────────────────────────────
  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch("/api/admin/books", { headers: { "x-admin-secret": secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBooks(data.books || []);
    } catch (err) {
      console.error("loadBooks error:", err);
    } finally {
      setLoadingBooks(false);
    }
  }, [secret]);

  useEffect(() => {
    if (authenticated && books.length === 0) loadBooks();
  }, [authenticated, books.length, loadBooks]);

  async function createResource() {
    if (!newTitle) return;
    setCreatingBook(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ title: newTitle, subject: newSubject, doc_type: newDocType, engineering: newEngineering, section: newSection }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.book) {
        setBooks((prev) => [data.book, ...prev]);
        setNewTitle(""); setShowAddForm(false); setCreateError("");
        openDetail(data.book);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setCreatingBook(false);
    }
  }

  function openDetail(book: SourceDocument) {
    setDetailBook(book);
    setChTitle(""); setChIndex(""); setChTotal(""); setChFile(null);
    setChStatus("idle"); setChMsg(""); setProcessed([]);
  }

  async function uploadToStorage(file: File, label: string): Promise<string> {
    const urlRes = await fetch("/api/admin/storage-upload-url", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ filename: `${label}.pdf` }),
    });
    if (!urlRes.ok) { const e = await urlRes.json().catch(() => ({})); throw new Error(e.error || "Signed URL error"); }
    const { signedUrl, path } = await urlRes.json();
    const uploadRes = await fetch(signedUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: file });
    if (!uploadRes.ok) throw new Error(`Upload fallito: ${uploadRes.statusText}`);
    return path;
  }

  async function handleProcessChapter() {
    if (!chFile || !chTitle || !detailBook) return;
    const isLatex = chFile.name.endsWith(".tex");
    setChStatus(isLatex ? "processing" : "uploading");
    setChMsg("");
    try {
      let res: Response;

      if (isLatex) {
        // LaTeX: read as text, send directly — no storage needed
        const latexContent = await chFile.text();
        res = await fetch("/api/admin/process-latex", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-secret": secret },
          body: JSON.stringify({
            latexContent,
            sourceDocumentId: detailBook.id,
            chapterTitle: chTitle,
            chapterIndex: chIndex ? parseInt(chIndex) : undefined,
            totalChapters: chTotal ? parseInt(chTotal) : undefined,
          }),
        });
      } else {
        // PDF: upload to storage first, then process
        const storagePath = await uploadToStorage(chFile, chTitle);
        setChStatus("processing");
        res = await fetch("/api/admin/process-chapter", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-secret": secret },
          body: JSON.stringify({
            storagePath, sourceDocumentId: detailBook.id, chapterTitle: chTitle,
            chapterIndex: chIndex ? parseInt(chIndex) : undefined,
            totalChapters: chTotal ? parseInt(chTotal) : undefined,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      const label = detailBook.doc_type === "libro_teoria" ? "lezioni" : "esercizi";
      setProcessed((prev) => [...prev, { chapterTitle: chTitle, extracted: data.extracted, label }]);
      setChMsg(`${data.extracted} ${label} estratti`);
      setChStatus("done");
      setChTitle(""); setChFile(null); setChIndex("");
    } catch (err) {
      setChMsg(err instanceof Error ? err.message : "Errore");
      setChStatus("error");
    }
  }

  // ── Exercises ──────────────────────────────────────────────────────────────
  async function handleExerciseUpload() {
    if (!exFile || !exTitle) return;
    setExStatus("processing"); setExMsg("");
    try {
      if (exFile.name.endsWith(".tex")) {
        // Create a source_document first, then process as LaTeX
        const bookRes = await fetch("/api/admin/books", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-secret": secret },
          body: JSON.stringify({ title: exTitle, subject: exSubject, doc_type: exSource, engineering: exEngineering, section: exSection }),
        });
        const bookData = await bookRes.json();
        if (!bookRes.ok) throw new Error(bookData.error);
        setBooks((prev) => [bookData.book, ...prev]);
        const latexContent = await exFile.text();
        const res = await fetch("/api/admin/process-latex", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-secret": secret },
          body: JSON.stringify({ latexContent, sourceDocumentId: bookData.book.id, chapterTitle: exTitle }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setExMsg(`Estratti ${data.extracted} esercizi da "${exTitle}"`);
      } else {
        const formData = new FormData();
        formData.append("file", exFile); formData.append("subject", exSubject);
        formData.append("source", exSource); formData.append("title", exTitle);
        formData.append("engineering", exEngineering); formData.append("section", exSection);
        if (exYear) formData.append("year", exYear);
        const res = await fetch("/api/admin/process-exercises", { method: "POST", headers: { "x-admin-secret": secret }, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setExMsg(`Estratti ${data.extracted} esercizi da "${exTitle}"`);
      }
      setExStatus("done"); setExFile(null); setExTitle(""); setExYear("");
    } catch (err) { setExMsg(err instanceof Error ? err.message : "Errore"); setExStatus("error"); }
  }

  // ── Theory ─────────────────────────────────────────────────────────────────
  async function handleTheoryUpload() {
    if (!thFile || !thTitle) return;
    setThStatus("processing"); setThMsg("");
    try {
      if (thFile.name.endsWith(".tex")) {
        const bookRes = await fetch("/api/admin/books", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-secret": secret },
          body: JSON.stringify({ title: thTitle, subject: thSubject, doc_type: "libro_teoria", engineering: thEngineering, section: thSection }),
        });
        const bookData = await bookRes.json();
        if (!bookRes.ok) throw new Error(bookData.error);
        setBooks((prev) => [bookData.book, ...prev]);
        const latexContent = await thFile.text();
        const res = await fetch("/api/admin/process-latex", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-secret": secret },
          body: JSON.stringify({ latexContent, sourceDocumentId: bookData.book.id, chapterTitle: thTitle }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setThMsg(`Estratte ${data.extracted} lezioni da "${thTitle}"`);
      } else {
        const formData = new FormData();
        formData.append("file", thFile); formData.append("subject", thSubject);
        formData.append("title", thTitle); formData.append("engineering", thEngineering);
        formData.append("section", thSection);
        const res = await fetch("/api/admin/process-theory", { method: "POST", headers: { "x-admin-secret": secret }, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setThMsg(`Estratte ${data.extracted} lezioni da "${thTitle}"`);
      }
      setThStatus("done"); setThFile(null); setThTitle("");
    } catch (err) { setThMsg(err instanceof Error ? err.message : "Errore"); setThStatus("error"); }
  }

  // ── Review ─────────────────────────────────────────────────────────────────
  async function loadExercises() {
    setLoadingReview(true);
    const res = await fetch(`/api/admin/exercises?subject=${reviewSubject}`, { headers: { "x-admin-secret": secret } });
    const data = await res.json();
    setExercises(data.exercises || []); setLoadingReview(false);
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Admin Educly</h1>
            <p className="text-sm text-muted-foreground mt-1">Area riservata</p>
          </div>
          <div className="bg-card border rounded-2xl p-6 space-y-4">
            <Field label="Password">
              <Input
                id={`${uid}-pw`}
                type="password"
                value={secret}
                onChange={(e) => { setSecret(e.target.value); setAuthError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className={authError ? "border-red-500 focus-visible:ring-red-400" : ""}
              />
              {authError && <p className="text-xs text-red-500 mt-1">Password errata.</p>}
            </Field>
            <Button className="w-full" onClick={handleLogin} disabled={!secret || authLoading}>
              {authLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Accedi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: "library", label: "Libreria", icon: <Library className="h-4 w-4" /> },
    { id: "exercises", label: "Esercizi", icon: <PenLine className="h-4 w-4" /> },
    { id: "theory", label: "Teoria", icon: <BookOpen className="h-4 w-4" /> },
    { id: "review", label: "Rivedi", icon: <Eye className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top nav */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-1 h-14">
          <span className="font-bold text-sm mr-4">Admin</span>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => { setPage(n.id); setDetailBook(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                page === n.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {n.icon}{n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── LIBRARY ── */}
        {page === "library" && !detailBook && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Libreria</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Libri, eserciziarii e dispense caricate</p>
              </div>
              <Button onClick={() => setShowAddForm((v) => !v)} className="gap-1.5">
                {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showAddForm ? "Annulla" : "Aggiungi risorsa"}
              </Button>
            </div>

            {/* Add resource form */}
            {showAddForm && (
              <div className="bg-card border rounded-2xl p-5 space-y-4">
                <p className="font-semibold text-sm">Nuova risorsa</p>
                <Field label="Titolo">
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="es. Bramanti Pagani Salsa — Analisi Matematica 1"
                    onKeyDown={(e) => e.key === "Enter" && createResource()} />
                </Field>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Materia">
                    <NativeSelect value={newSubject} onChange={setNewSubject}
                      options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                  </Field>
                  <Field label="Tipo">
                    <NativeSelect value={newDocType} onChange={setNewDocType}
                      options={[
                        { id: "libro_teoria", name: "Libro di teoria" },
                        { id: "eserciziario", name: "Eserciziario" },
                        { id: "dispensa", name: "Dispensa" },
                      ]} />
                  </Field>
                  <Field label="Ingegneria">
                    <NativeSelect value={newEngineering} onChange={setNewEngineering}
                      options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
                  </Field>
                  <Field label="Scaglione">
                    <NativeSelect value={newSection} onChange={setNewSection}
                      options={SECTIONS.map((s) => ({ id: s, name: s === "tutti" ? "Tutti" : `Scaglione ${s}` }))} />
                  </Field>
                </div>
                {createError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={createResource} disabled={!newTitle || creatingBook}>
                    {creatingBook ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creazione…</> : "Crea risorsa"}
                  </Button>
                </div>
              </div>
            )}

            {/* Grid */}
            {loadingBooks ? (
              <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : books.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Library className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="font-medium text-sm">Nessuna risorsa ancora</p>
                <p className="text-xs text-muted-foreground mt-1">Clicca &quot;Aggiungi risorsa&quot; per iniziare</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {books.map((b) => (
                  <ResourceCard key={b.id} resource={b} onClick={() => openDetail(b)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LIBRARY DETAIL ── */}
        {page === "library" && detailBook && (
          <div className="space-y-6 max-w-2xl">
            {/* Back + title */}
            <div>
              <button
                onClick={() => setDetailBook(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="h-4 w-4" />Libreria
              </button>
              <h1 className="text-xl font-bold leading-snug">{detailBook.title}</h1>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="secondary">{detailBook.subject}</Badge>
                <Badge variant="outline">{DOC_TYPE_LABELS[detailBook.doc_type] ?? detailBook.doc_type}</Badge>
                {detailBook.engineering !== "tutti" && <Badge variant="outline">{detailBook.engineering}</Badge>}
                {detailBook.section !== "tutti" && <Badge variant="outline">Scaglione {detailBook.section}</Badge>}
              </div>
            </div>

            <Separator />

            {/* Chapter upload form */}
            <div className="bg-card border rounded-2xl p-5 space-y-4">
              <p className="font-semibold text-sm">Aggiungi capitolo</p>

              <Field
                label="Titolo capitolo"
                hint={'Includi "Parte 1", "Parte 2" nel titolo se il capitolo è diviso in più PDF.'}
              >
                <Input
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  placeholder="es. Capitolo 3 — Derivate — Parte 1"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="N° capitolo (opzionale)">
                  <Input type="number" value={chIndex} onChange={(e) => setChIndex(e.target.value)} placeholder="es. 3" />
                </Field>
                <Field label="Totale capitoli (opzionale)">
                  <Input type="number" value={chTotal} onChange={(e) => setChTotal(e.target.value)} placeholder="es. 12" />
                </Field>
              </div>

              <FilePickerRow
                file={chFile}
                onChange={setChFile}
                accept=".pdf,.tex"
                disabled={chStatus === "uploading" || chStatus === "processing"}
              />

              <StatusBanner status={chStatus} message={chMsg} />

              <Button
                className="w-full"
                onClick={handleProcessChapter}
                disabled={!chFile || !chTitle || chStatus === "uploading" || chStatus === "processing"}
              >
                {chStatus === "uploading" || chStatus === "processing" ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {chStatus === "uploading" ? "Caricamento…" : "Claude sta leggendo…"}
                  </>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Processa capitolo</>
                )}
              </Button>
            </div>

            {/* Processed log */}
            {processed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Processati questa sessione
                </p>
                <div className="space-y-1.5">
                  {processed.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="flex-1 font-medium truncate">{entry.chapterTitle}</span>
                      <span className="text-green-700 dark:text-green-400 shrink-0 text-xs">{entry.extracted} {entry.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EXERCISES ── */}
        {page === "exercises" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold">Esercizi standalone</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Eserciziarii o temi d&apos;esame non legati a un libro</p>
            </div>
            <div className="bg-card border rounded-2xl p-5 space-y-4">
              <FilePickerRow file={exFile} onChange={setExFile} accept=".pdf,.tex" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Materia">
                  <NativeSelect value={exSubject} onChange={setExSubject}
                    options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                </Field>
                <Field label="Tipo documento">
                  <NativeSelect value={exSource} onChange={setExSource}
                    options={EXERCISE_SOURCES.map((s) => ({ id: s.id, name: s.name }))} />
                </Field>
                <Field label="Ingegneria">
                  <NativeSelect value={exEngineering} onChange={setExEngineering}
                    options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
                </Field>
                <Field label="Scaglione">
                  <NativeSelect value={exSection} onChange={setExSection}
                    options={SECTIONS.map((s) => ({ id: s, name: s === "tutti" ? "Tutti" : `Scaglione ${s}` }))} />
                </Field>
              </div>
              <Field label="Titolo documento">
                <Input value={exTitle} onChange={(e) => setExTitle(e.target.value)}
                  placeholder="es. Bramanti — Capitolo Integrali" />
              </Field>
              {exSource === "tema_passato" && (
                <Field label="Anno esame">
                  <Input type="number" value={exYear} onChange={(e) => setExYear(e.target.value)} placeholder="es. 2024" />
                </Field>
              )}
              <StatusBanner status={exStatus} message={exMsg} />
              <Button className="w-full" onClick={handleExerciseUpload}
                disabled={!exFile || !exTitle || exStatus === "processing"}>
                {exStatus === "processing"
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione…</>
                  : <><Upload className="h-4 w-4 mr-2" />Carica e processa</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── THEORY ── */}
        {page === "theory" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold">Teoria standalone</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Dispense o capitoli non legati a un libro</p>
            </div>
            <div className="bg-card border rounded-2xl p-5 space-y-4">
              <FilePickerRow file={thFile} onChange={setThFile} accept=".pdf,.tex" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Materia">
                  <NativeSelect value={thSubject} onChange={setThSubject}
                    options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                </Field>
                <Field label="Ingegneria">
                  <NativeSelect value={thEngineering} onChange={setThEngineering}
                    options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
                </Field>
                <Field label="Scaglione">
                  <NativeSelect value={thSection} onChange={setThSection}
                    options={SECTIONS.map((s) => ({ id: s, name: s === "tutti" ? "Tutti" : `Scaglione ${s}` }))} />
                </Field>
              </div>
              <Field label="Titolo documento">
                <Input value={thTitle} onChange={(e) => setThTitle(e.target.value)}
                  placeholder="es. Bramanti Pagani Salsa — Capitolo 3" />
              </Field>
              <StatusBanner status={thStatus} message={thMsg} />
              <Button className="w-full" onClick={handleTheoryUpload}
                disabled={!thFile || !thTitle || thStatus === "processing"}>
                {thStatus === "processing"
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione…</>
                  : <><Upload className="h-4 w-4 mr-2" />Carica e processa</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {page === "review" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold">Rivedi esercizi</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Controlla e modifica gli esercizi estratti</p>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Field label="Materia">
                  <NativeSelect value={reviewSubject} onChange={setReviewSubject}
                    options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                </Field>
              </div>
              <Button onClick={loadExercises} disabled={loadingReview}>
                {loadingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carica"}
              </Button>
            </div>
            {exercises.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{exercises.length} esercizi</p>
                {exercises.map((ex) => (
                  <ExerciseCard key={ex.id} ex={ex} secret={secret}
                    onDelete={(id) => setExercises((prev) => prev.filter((e) => e.id !== id))} />
                ))}
              </div>
            ) : (
              !loadingReview && (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nessun esercizio caricato per questa materia.
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
