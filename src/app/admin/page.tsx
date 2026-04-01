"use client";

import { useState, useEffect, useRef } from "react";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Upload, CheckCircle, AlertCircle, Loader2,
  BookOpen, PenLine, Eye, Pencil, Trash2, Save, X, Plus, Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/MathText";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

const SUBJECTS = [
  { id: "analisi1", name: "Analisi 1" },
  { id: "analisi2", name: "Analisi 2" },
];

const ENGINEERING_OPTIONS = [
  "tutti",
  "Ingegneria Fisica",
  "Ingegneria Informatica",
  "Ingegneria Meccanica",
  "Ingegneria Civile",
  "Ingegneria Elettronica",
  "Ingegneria Energetica",
  "Ingegneria Aerospaziale",
  "Ingegneria Biomedica",
  "Ingegneria Matematica",
];

const SECTIONS = ["tutti", "AM", "MZ", "A", "B", "C", "D"];

const EXERCISE_SOURCES = [
  { id: "eserciziario", name: "Eserciziario" },
  { id: "tema_passato", name: "Tema d'esame passato" },
  { id: "dispensa", name: "Dispensa con esercizi" },
];

const DIFFICULTY_LABELS: Record<number, string> = { 1: "Facile", 2: "Medio", 3: "Difficile" };

// ── shared field component ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
    >
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

function FileUploadZone({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className={cn(
      "flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
      file ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50 hover:bg-muted/30"
    )}>
      <input type="file" accept=".pdf" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      <Upload className={cn("h-5 w-5 mb-1.5", file ? "text-primary" : "text-muted-foreground")} />
      {file ? (
        <div className="text-center">
          <p className="text-sm font-medium text-primary">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Trascina il PDF o clicca per selezionarlo</p>
      )}
    </label>
  );
}

function StatusBanner({ status, message }: { status: Status; message?: string }) {
  if (status === "idle") return null;
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border text-sm",
      status === "processing" || status === "uploading" ? "bg-blue-50 border-blue-200 text-blue-800"
        : status === "done" ? "bg-green-50 border-green-200 text-green-800"
        : "bg-red-50 border-red-200 text-red-800"
    )}>
      {(status === "processing" || status === "uploading") && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      {status === "done" && <CheckCircle className="h-4 w-4 shrink-0" />}
      {status === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
      <span>
        {status === "uploading" && "Caricamento..."}
        {status === "processing" && "Claude sta analizzando il PDF — può richiedere 1–2 minuti..."}
        {status === "done" && (message || "Completato!")}
        {status === "error" && (message || "Errore durante il processing.")}
      </span>
    </div>
  );
}

// ── Exercise editor ───────────────────────────────────────────────────────────
interface Exercise {
  id: string;
  topic_id: string;
  difficulty: number;
  source: string;
  question_latex: string;
  solution_latex: string;
  hints: string[];
  engineering: string;
  section: string;
}

function ExerciseCard({
  ex, secret, onDelete,
}: {
  ex: Exercise;
  secret: string;
  onDelete: (id: string) => void;
}) {
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
    setSaving(false);
    setEditing(false);
  }

  async function del() {
    if (!confirm("Eliminare questo esercizio?")) return;
    await fetch(`/api/admin/exercises/${ex.id}`, {
      method: "DELETE",
      headers: { "x-admin-secret": secret },
    });
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
            <button onClick={del} className="p-1.5 rounded hover:bg-red-50 text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <Field label="Domanda (LaTeX)">
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm font-mono min-h-24 resize-y"
                value={form.question_latex}
                onChange={(e) => setForm({ ...form, question_latex: e.target.value })}
              />
            </Field>
            <Field label="Soluzione (LaTeX)">
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm font-mono min-h-32 resize-y"
                value={form.solution_latex}
                onChange={(e) => setForm({ ...form, solution_latex: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Difficoltà">
                <NativeSelect
                  value={String(form.difficulty)}
                  onChange={(v) => setForm({ ...form, difficulty: parseInt(v) })}
                  options={[{ id: "1", name: "Facile" }, { id: "2", name: "Medio" }, { id: "3", name: "Difficile" }]}
                />
              </Field>
              <Field label="Ingegneria">
                <NativeSelect
                  value={form.engineering}
                  onChange={(v) => setForm({ ...form, engineering: v })}
                  options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))}
                />
              </Field>
            </div>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Salva
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

// ── Main admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Upload form state
  const [exFile, setExFile] = useState<File | null>(null);
  const [exSubject, setExSubject] = useState("analisi1");
  const [exSource, setExSource] = useState("eserciziario");
  const [exTitle, setExTitle] = useState("");
  const [exYear, setExYear] = useState("");
  const [exEngineering, setExEngineering] = useState("tutti");
  const [exSection, setExSection] = useState("tutti");
  const [exStatus, setExStatus] = useState<Status>("idle");
  const [exMsg, setExMsg] = useState("");

  const [thFile, setThFile] = useState<File | null>(null);
  const [thSubject, setThSubject] = useState("analisi1");
  const [thTitle, setThTitle] = useState("");
  const [thEngineering, setThEngineering] = useState("tutti");
  const [thSection, setThSection] = useState("tutti");
  const [thStatus, setThStatus] = useState<Status>("idle");
  const [thMsg, setThMsg] = useState("");

  // Book (multi-chapter) shared state
  const [bookTitle, setBookTitle] = useState("");
  const [bookSubject, setBookSubject] = useState("analisi1");
  const [bookDocType, setBookDocType] = useState("libro_teoria");
  const [bookEngineering, setBookEngineering] = useState("tutti");
  const [bookSection, setBookSection] = useState("tutti");
  const [bookMode, setBookMode] = useState<"manual" | "auto">("auto");
  const [bookStatus, setBookStatus] = useState<Status>("idle");
  const [bookMsg, setBookMsg] = useState("");

  // Manual mode
  interface ManualChapter { title: string; file: File | null }
  const [chapters, setChapters] = useState<ManualChapter[]>([{ title: "", file: null }]);

  function addChapter() { setChapters((prev) => [...prev, { title: "", file: null }]); }
  function removeChapter(i: number) { setChapters((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateChapter(i: number, patch: Partial<ManualChapter>) {
    setChapters((prev) => prev.map((ch, idx) => idx === i ? { ...ch, ...patch } : ch));
  }

  // Upload a File to Supabase Storage tmp-pdfs bucket, return the storage path
  async function uploadToStorage(file: File, label: string): Promise<string> {
    const supabase = createClient();
    const path = `admin/${Date.now()}-${label.replace(/[^a-z0-9]/gi, "_")}.pdf`;
    const { error } = await supabase.storage.from("tmp-pdfs").upload(path, file, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw new Error(`Upload storage fallito: ${error.message}`);
    return path;
  }

  // Process one chapter via API (JSON body with storagePath)
  async function processChapter({
    storagePath,
    chapterTitle,
    chapterIndex,
    totalChapters,
    sourceDocumentId,
    lessonOrderStart,
  }: {
    storagePath: string;
    chapterTitle: string;
    chapterIndex: number;
    totalChapters: number;
    sourceDocumentId: string | null;
    lessonOrderStart: number;
  }) {
    const res = await fetch("/api/admin/process-chapter", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({
        storagePath,
        bookTitle,
        chapterTitle,
        subject: bookSubject,
        docType: bookDocType,
        engineering: bookEngineering,
        section: bookSection,
        chapterIndex,
        totalChapters,
        lessonOrderStart,
        sourceDocumentId,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Errore capitolo ${chapterIndex}`);
    return data as { sourceDocumentId: string; extracted: number; error?: string };
  }

  async function handleBookUpload() {
    const validChapters = chapters.filter((ch) => ch.title && ch.file);
    if (!bookTitle || validChapters.length === 0) return;
    setBookStatus("processing");
    setBookMsg("");

    let sourceDocumentId: string | null = null;
    let totalExtracted = 0;
    let lessonOrderStart = 1;

    try {
      for (let i = 0; i < validChapters.length; i++) {
        const ch = validChapters[i];
        setBookMsg(`Caricamento capitolo ${i + 1} di ${validChapters.length}: "${ch.title}"…`);
        const storagePath = await uploadToStorage(ch.file!, ch.title);
        setBookMsg(`Elaborazione capitolo ${i + 1} di ${validChapters.length}: "${ch.title}"…`);
        const result = await processChapter({
          storagePath,
          chapterTitle: ch.title,
          chapterIndex: i + 1,
          totalChapters: validChapters.length,
          sourceDocumentId,
          lessonOrderStart,
        });
        sourceDocumentId = result.sourceDocumentId;
        totalExtracted += result.extracted;
        lessonOrderStart += result.extracted;
      }
      const label = bookDocType === "libro_teoria" ? "lezioni" : "esercizi";
      setBookMsg(`Libro processato: ${totalExtracted} ${label} estratti da ${validChapters.length} capitoli.`);
      setBookStatus("done");
    } catch (err) {
      setBookMsg(err instanceof Error ? err.message : "Errore");
      setBookStatus("error");
    }
  }

  // Auto-split mode
  interface AutoChapter { title: string; toc_page: number; pdf_page_index: number }
  const [autoFile, setAutoFile] = useState<File | null>(null);
  const [autoChapters, setAutoChapters] = useState<AutoChapter[]>([]);
  const [analyzeStatus, setAnalyzeStatus] = useState<Status>("idle");
  const [analyzeMsg, setAnalyzeMsg] = useState("");

  function updateAutoChapter(i: number, patch: Partial<AutoChapter>) {
    setAutoChapters((prev) => prev.map((ch, idx) => idx === i ? { ...ch, ...patch } : ch));
  }
  function removeAutoChapter(i: number) {
    setAutoChapters((prev) => prev.filter((_, idx) => idx !== i));
  }

  const [autoProgress, setAutoProgress] = useState<{ current: number; total: number } | null>(null);
  const fullPdfRef = useRef<PDFDocument | null>(null);

  async function handleAnalyzeToc() {
    if (!autoFile) return;
    setAnalyzeStatus("processing");
    setAnalyzeMsg("Lettura PDF e analisi indice...");
    setAutoChapters([]);
    try {
      // Load and cache full PDF in memory
      const arrayBuffer = await autoFile.arrayBuffer();
      const fullPdf = await PDFDocument.load(arrayBuffer);
      fullPdfRef.current = fullPdf;
      const totalPages = fullPdf.getPageCount();

      // Send only first 50 pages to keep payload small (TOC is always at the start)
      const tocPageCount = Math.min(50, totalPages);
      const tocPdf = await PDFDocument.create();
      const tocPages = await tocPdf.copyPages(fullPdf, Array.from({ length: tocPageCount }, (_, i) => i));
      tocPages.forEach((p) => tocPdf.addPage(p));
      const tocBytes = await tocPdf.save();
      const tocBlob = new Blob([tocBytes.buffer as ArrayBuffer], { type: "application/pdf" });

      const formData = new FormData();
      formData.append("file", tocBlob, autoFile.name);

      const res = await fetch("/api/admin/analyze-toc", {
        method: "POST",
        headers: { "x-admin-secret": secret },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAutoChapters(data.chapters);
      setAnalyzeStatus("done");
      setAnalyzeMsg(`Trovati ${data.chapters.length} capitoli — controlla i titoli e processa.`);
    } catch (err) {
      setAnalyzeMsg(err instanceof Error ? err.message : "Errore");
      setAnalyzeStatus("error");
    }
  }

  async function handleAutoBookProcess() {
    if (!autoFile || autoChapters.length === 0 || !bookTitle) return;
    setBookStatus("processing");
    setBookMsg("Suddivisione capitoli nel browser…");
    setAutoProgress(null);
    try {
      let fullPdf = fullPdfRef.current;
      if (!fullPdf) {
        const arrayBuffer = await autoFile.arrayBuffer();
        fullPdf = await PDFDocument.load(arrayBuffer);
        fullPdfRef.current = fullPdf;
      }
      const totalPages = fullPdf.getPageCount();

      let sourceDocumentId: string | null = null;
      let totalExtracted = 0;
      let lessonOrderStart = 1;

      for (let i = 0; i < autoChapters.length; i++) {
        const chapter = autoChapters[i];
        setAutoProgress({ current: i + 1, total: autoChapters.length });
        setBookMsg(`Caricamento capitolo ${i + 1} di ${autoChapters.length}: "${chapter.title}"…`);

        // Slice chapter pages
        const startPage = Math.max(0, Math.min(chapter.pdf_page_index, totalPages - 1));
        const endPage = i < autoChapters.length - 1
          ? Math.max(startPage, Math.min(autoChapters[i + 1].pdf_page_index - 1, totalPages - 1))
          : totalPages - 1;

        const chapterPdf = await PDFDocument.create();
        const pageIndices = Array.from({ length: endPage - startPage + 1 }, (_, k) => startPage + k);
        const copiedPages = await chapterPdf.copyPages(fullPdf, pageIndices);
        copiedPages.forEach((p) => chapterPdf.addPage(p));
        const chapterBytes = await chapterPdf.save();
        const chapterBlob = new Blob([chapterBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const chapterFile = new File([chapterBlob], `${chapter.title}.pdf`, { type: "application/pdf" });

        // Upload to Storage
        const storagePath = await uploadToStorage(chapterFile, chapter.title);
        setBookMsg(`Elaborazione capitolo ${i + 1} di ${autoChapters.length}: "${chapter.title}"…`);

        const result = await processChapter({
          storagePath,
          chapterTitle: chapter.title,
          chapterIndex: i + 1,
          totalChapters: autoChapters.length,
          sourceDocumentId,
          lessonOrderStart,
        });
        sourceDocumentId = result.sourceDocumentId;
        totalExtracted += result.extracted;
        lessonOrderStart += result.extracted;
      }

      const label = bookDocType === "libro_teoria" ? "lezioni" : "esercizi";
      setBookMsg(`Libro processato: ${totalExtracted} ${label} estratti da ${autoChapters.length} capitoli.`);
      setBookStatus("done");
      setAutoProgress(null);
    } catch (err) {
      setBookMsg(err instanceof Error ? err.message : "Errore");
      setBookStatus("error");
      setAutoProgress(null);
    }
  }

  // Review state
  const [reviewSubject, setReviewSubject] = useState("analisi1");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  async function loadExercises() {
    setLoadingReview(true);
    const res = await fetch(`/api/admin/exercises?subject=${reviewSubject}`, {
      headers: { "x-admin-secret": secret },
    });
    const data = await res.json();
    setExercises(data.exercises || []);
    setLoadingReview(false);
  }

  async function handleExerciseUpload() {
    if (!exFile || !exTitle) return;
    setExStatus("processing");
    setExMsg("");
    const formData = new FormData();
    formData.append("file", exFile);
    formData.append("subject", exSubject);
    formData.append("source", exSource);
    formData.append("title", exTitle);
    formData.append("engineering", exEngineering);
    formData.append("section", exSection);
    if (exYear) formData.append("year", exYear);

    try {
      const res = await fetch("/api/admin/process-exercises", {
        method: "POST",
        headers: { "x-admin-secret": secret },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExMsg(`Estratti ${data.extracted} esercizi da "${exTitle}"`);
      setExStatus("done");
      setExFile(null); setExTitle(""); setExYear("");
    } catch (err) {
      setExMsg(err instanceof Error ? err.message : "Errore");
      setExStatus("error");
    }
  }

  async function handleTheoryUpload() {
    if (!thFile || !thTitle) return;
    setThStatus("processing");
    setThMsg("");
    const formData = new FormData();
    formData.append("file", thFile);
    formData.append("subject", thSubject);
    formData.append("title", thTitle);
    formData.append("engineering", thEngineering);
    formData.append("section", thSection);

    try {
      const res = await fetch("/api/admin/process-theory", {
        method: "POST",
        headers: { "x-admin-secret": secret },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThMsg(`Estratte ${data.extracted} lezioni da "${thTitle}"`);
      setThStatus("done");
      setThFile(null); setThTitle("");
    } catch (err) {
      setThMsg(err instanceof Error ? err.message : "Errore");
      setThStatus("error");
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle>Admin Educly</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Password admin">
              <Input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setAuthenticated(true)}
                placeholder="Password"
              />
            </Field>
            <Button className="w-full" onClick={() => setAuthenticated(true)}>Accedi</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin — Gestione materiali</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Carica PDF → Claude estrae esercizi e lezioni → rivedi e modifica → gli studenti li usano
          </p>
        </div>

        <Tabs defaultValue="book">
          <TabsList className="w-full">
            <TabsTrigger value="book" className="flex-1 gap-1.5"><Library className="h-4 w-4" />Libro</TabsTrigger>
            <TabsTrigger value="exercises" className="flex-1 gap-1.5"><PenLine className="h-4 w-4" />Esercizi</TabsTrigger>
            <TabsTrigger value="theory" className="flex-1 gap-1.5"><BookOpen className="h-4 w-4" />Teoria</TabsTrigger>
            <TabsTrigger value="review" className="flex-1 gap-1.5"><Eye className="h-4 w-4" />Rivedi</TabsTrigger>
          </TabsList>

          {/* ── BOOK (multi-chapter) ── */}
          <TabsContent value="book" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Carica un libro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Shared fields */}
                <Field label="Titolo del libro">
                  <Input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="es. Bramanti Pagani Salsa — Analisi Matematica 1" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Materia">
                    <NativeSelect value={bookSubject} onChange={setBookSubject}
                      options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                  </Field>
                  <Field label="Tipo documento">
                    <NativeSelect value={bookDocType} onChange={setBookDocType}
                      options={[
                        { id: "libro_teoria", name: "Libro di teoria" },
                        { id: "eserciziario", name: "Eserciziario" },
                      ]} />
                  </Field>
                  <Field label="Corso di ingegneria">
                    <NativeSelect value={bookEngineering} onChange={setBookEngineering}
                      options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
                  </Field>
                  <Field label="Scaglione">
                    <NativeSelect value={bookSection} onChange={setBookSection}
                      options={SECTIONS.map((s) => ({ id: s, name: s === "tutti" ? "Tutti gli scaglioni" : `Scaglione ${s}` }))} />
                  </Field>
                </div>

                <Separator />

                {/* Mode toggle */}
                <div className="flex rounded-lg border overflow-hidden text-sm">
                  <button
                    onClick={() => setBookMode("auto")}
                    className={cn(
                      "flex-1 py-2 font-medium transition-colors",
                      bookMode === "auto" ? "bg-primary text-white" : "hover:bg-muted/50"
                    )}
                  >
                    Auto-split (PDF unico)
                  </button>
                  <button
                    onClick={() => setBookMode("manual")}
                    className={cn(
                      "flex-1 py-2 font-medium transition-colors border-l",
                      bookMode === "manual" ? "bg-primary text-white" : "hover:bg-muted/50"
                    )}
                  >
                    Manuale (un PDF per capitolo)
                  </button>
                </div>

                {/* ── AUTO SPLIT ── */}
                {bookMode === "auto" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Carica il PDF completo del libro. Claude leggerà l&apos;indice, troverà la pagina esatta di ogni capitolo (anche se le pagine dell&apos;indice non corrispondono a quelle PDF), e dividerà automaticamente il libro per te.
                    </p>

                    <FileUploadZone file={autoFile} onChange={setAutoFile} />

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleAnalyzeToc}
                      disabled={!autoFile || analyzeStatus === "processing"}
                    >
                      {analyzeStatus === "processing"
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisi indice in corso...</>
                        : <><BookOpen className="h-4 w-4 mr-2" />Analizza indice</>}
                    </Button>

                    {analyzeStatus !== "idle" && (
                      <StatusBanner status={analyzeStatus} message={analyzeMsg} />
                    )}

                    {autoChapters.length > 0 && (
                      <div className="space-y-2">
                        <Label>Capitoli trovati — modifica se necessario</Label>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {autoChapters.map((ch, i) => (
                            <div key={i} className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/20">
                              <span className="text-xs text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                              <Input
                                className="flex-1 h-7 text-xs"
                                value={ch.title}
                                onChange={(e) => updateAutoChapter(i, { title: e.target.value })}
                              />
                              <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                                pag. indice {ch.toc_page} → PDF {ch.pdf_page_index}
                              </span>
                              <button onClick={() => removeAutoChapter(i)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {autoProgress && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Capitolo {autoProgress.current} di {autoProgress.total}</span>
                              <span>{Math.round((autoProgress.current / autoProgress.total) * 100)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${(autoProgress.current / autoProgress.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <StatusBanner status={bookStatus} message={bookMsg} />

                        <Button
                          className="w-full"
                          onClick={handleAutoBookProcess}
                          disabled={!bookTitle || bookStatus === "processing"}
                        >
                          {bookStatus === "processing"
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione...</>
                            : <><Library className="h-4 w-4 mr-2" />Processa tutto il libro ({autoChapters.length} capitoli)</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MANUAL ── */}
                {bookMode === "manual" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Carica ogni capitolo come PDF separato. Claude sa che fanno parte dello stesso libro e mantiene la coerenza tra i capitoli.
                    </p>

                    <div className="flex items-center justify-between">
                      <Label>Capitoli ({chapters.length})</Label>
                      <button onClick={addChapter} className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <Plus className="h-3.5 w-3.5" />Aggiungi capitolo
                      </button>
                    </div>

                    {chapters.map((ch, i) => (
                      <div key={i} className="border rounded-xl p-3 space-y-2 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground w-6">#{i + 1}</span>
                          <Input
                            className="flex-1 h-8 text-sm"
                            placeholder="Titolo capitolo (es. Capitolo 3 — Derivate)"
                            value={ch.title}
                            onChange={(e) => updateChapter(i, { title: e.target.value })}
                          />
                          {chapters.length > 1 && (
                            <button onClick={() => removeChapter(i)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <label className={cn(
                          "flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors",
                          ch.file ? "border-primary bg-primary/5 text-primary" : "border-dashed border-muted hover:border-primary/50"
                        )}>
                          <input type="file" accept=".pdf" className="hidden"
                            onChange={(e) => updateChapter(i, { file: e.target.files?.[0] || null })} />
                          <Upload className="h-4 w-4 shrink-0" />
                          {ch.file ? `${ch.file.name} (${(ch.file.size / 1024 / 1024).toFixed(1)} MB)` : "Seleziona PDF capitolo"}
                        </label>
                      </div>
                    ))}

                    <StatusBanner status={bookStatus} message={bookMsg} />

                    <Button
                      className="w-full"
                      onClick={handleBookUpload}
                      disabled={!bookTitle || chapters.filter((c) => c.title && c.file).length === 0 || bookStatus === "processing"}
                    >
                      {bookStatus === "processing"
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione capitoli...</>
                        : <><Library className="h-4 w-4 mr-2" />Processa tutto il libro</>}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EXERCISES UPLOAD ── */}
          <TabsContent value="exercises" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Carica eserciziario o tema d&apos;esame</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploadZone file={exFile} onChange={setExFile} />

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Materia">
                    <NativeSelect value={exSubject} onChange={setExSubject}
                      options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                  </Field>
                  <Field label="Tipo documento">
                    <NativeSelect value={exSource} onChange={setExSource}
                      options={EXERCISE_SOURCES.map((s) => ({ id: s.id, name: s.name }))} />
                  </Field>
                  <Field label="Corso di ingegneria">
                    <NativeSelect value={exEngineering} onChange={setExEngineering}
                      options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
                  </Field>
                  <Field label="Scaglione">
                    <NativeSelect value={exSection} onChange={setExSection}
                      options={SECTIONS.map((s) => ({ id: s, name: s === "tutti" ? "Tutti gli scaglioni" : `Scaglione ${s}` }))} />
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
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione...</>
                    : <><Upload className="h-4 w-4 mr-2" />Carica e processa</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── THEORY UPLOAD ── */}
          <TabsContent value="theory" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Carica libro di teoria o dispensa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploadZone file={thFile} onChange={setThFile} />

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Materia">
                    <NativeSelect value={thSubject} onChange={setThSubject}
                      options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                  </Field>
                  <Field label="Corso di ingegneria">
                    <NativeSelect value={thEngineering} onChange={setThEngineering}
                      options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
                  </Field>
                  <Field label="Scaglione">
                    <NativeSelect value={thSection} onChange={setThSection}
                      options={SECTIONS.map((s) => ({ id: s, name: s === "tutti" ? "Tutti gli scaglioni" : `Scaglione ${s}` }))} />
                  </Field>
                </div>

                <Field label="Titolo documento">
                  <Input value={thTitle} onChange={(e) => setThTitle(e.target.value)}
                    placeholder="es. Bramanti Pagani Salsa — Analisi Matematica 1" />
                </Field>

                <StatusBanner status={thStatus} message={thMsg} />

                <Button className="w-full" onClick={handleTheoryUpload}
                  disabled={!thFile || !thTitle || thStatus === "processing"}>
                  {thStatus === "processing"
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione...</>
                    : <><Upload className="h-4 w-4 mr-2" />Carica e processa</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── REVIEW & EDIT ── */}
          <TabsContent value="review" className="space-y-4 mt-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Field label="Materia">
                  <NativeSelect value={reviewSubject} onChange={setReviewSubject}
                    options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                </Field>
              </div>
              <Button onClick={loadExercises} disabled={loadingReview}>
                {loadingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carica esercizi"}
              </Button>
            </div>

            {exercises.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{exercises.length} esercizi trovati</p>
                {exercises.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    secret={secret}
                    onDelete={(id) => setExercises((prev) => prev.filter((e) => e.id !== id))}
                  />
                ))}
              </div>
            )}

            {!loadingReview && exercises.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessun esercizio caricato per questa materia.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
