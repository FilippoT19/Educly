"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Upload, CheckCircle, AlertCircle, Loader2,
  BookOpen, PenLine, Eye, Pencil, Trash2, Save, X, Plus, Library, ChevronRight,
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
        {status === "uploading" && "Caricamento su Supabase Storage..."}
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface SourceDocument {
  id: string;
  title: string;
  subject: string;
  doc_type: string;
  engineering: string;
  section: string;
}

// ── Main admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // ── Books ──────────────────────────────────────────────────────────────────
  const [books, setBooks] = useState<SourceDocument[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  // Create book form
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookSubject, setNewBookSubject] = useState("analisi1");
  const [newBookDocType, setNewBookDocType] = useState("libro_teoria");
  const [newBookEngineering, setNewBookEngineering] = useState("tutti");
  const [newBookSection, setNewBookSection] = useState("tutti");
  const [creatingBook, setCreatingBook] = useState(false);

  // Chapter upload form
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterIndex, setChapterIndex] = useState("");
  const [totalChapters, setTotalChapters] = useState("");
  const [chapterFile, setChapterFile] = useState<File | null>(null);
  const [chapterStatus, setChapterStatus] = useState<Status>("idle");
  const [chapterMsg, setChapterMsg] = useState("");

  // ── Upload form state (exercises / theory tabs) ─────────────────────────
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

  // Review state
  const [reviewSubject, setReviewSubject] = useState("analisi1");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  // ── Load books ─────────────────────────────────────────────────────────────
  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    const res = await fetch("/api/admin/books", {
      headers: { "x-admin-secret": secret },
    });
    const data = await res.json();
    setBooks(data.books || []);
    setLoadingBooks(false);
  }, [secret]);

  useEffect(() => {
    if (authenticated) loadBooks();
  }, [authenticated, loadBooks]);

  // ── Create book ────────────────────────────────────────────────────────────
  async function createBook() {
    if (!newBookTitle) return;
    setCreatingBook(true);
    const res = await fetch("/api/admin/books", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({
        title: newBookTitle,
        subject: newBookSubject,
        doc_type: newBookDocType,
        engineering: newBookEngineering,
        section: newBookSection,
      }),
    });
    const data = await res.json();
    setCreatingBook(false);
    if (data.book) {
      setBooks((prev) => [data.book, ...prev]);
      setSelectedBookId(data.book.id);
      setShowCreateBook(false);
      setNewBookTitle("");
    }
  }

  // ── Upload PDF to Supabase Storage via signed URL ─────────────────────────
  async function uploadToStorage(file: File, label: string): Promise<string> {
    const urlRes = await fetch("/api/admin/storage-upload-url", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ filename: `${label}.pdf` }),
    });
    if (!urlRes.ok) {
      const err = await urlRes.json().catch(() => ({}));
      throw new Error(`Signed URL error: ${err.error || urlRes.statusText}`);
    }
    const { signedUrl, path } = await urlRes.json();

    const uploadRes = await fetch(signedUrl, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      body: file,
    });
    if (!uploadRes.ok) throw new Error(`Upload fallito: ${uploadRes.status} ${uploadRes.statusText}`);
    return path;
  }

  // ── Process one chapter ────────────────────────────────────────────────────
  async function handleChapterUpload() {
    if (!chapterFile || !chapterTitle || !selectedBookId) return;
    setChapterStatus("uploading");
    setChapterMsg("");
    try {
      const storagePath = await uploadToStorage(chapterFile, chapterTitle);
      setChapterStatus("processing");
      const res = await fetch("/api/admin/process-chapter", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({
          storagePath,
          sourceDocumentId: selectedBookId,
          chapterTitle,
          chapterIndex: chapterIndex ? parseInt(chapterIndex) : undefined,
          totalChapters: totalChapters ? parseInt(totalChapters) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      const book = books.find((b) => b.id === selectedBookId);
      const label = book?.doc_type === "libro_teoria" ? "lezioni" : "esercizi";
      setChapterMsg(`Estratti ${data.extracted} ${label} da "${chapterTitle}"`);
      setChapterStatus("done");
      setChapterTitle("");
      setChapterFile(null);
      setChapterIndex("");
    } catch (err) {
      setChapterMsg(err instanceof Error ? err.message : "Errore");
      setChapterStatus("error");
    }
  }

  // ── Exercise upload ────────────────────────────────────────────────────────
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

  // ── Theory upload ──────────────────────────────────────────────────────────
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

  // ── Review ─────────────────────────────────────────────────────────────────
  async function loadExercises() {
    setLoadingReview(true);
    const res = await fetch(`/api/admin/exercises?subject=${reviewSubject}`, {
      headers: { "x-admin-secret": secret },
    });
    const data = await res.json();
    setExercises(data.exercises || []);
    setLoadingReview(false);
  }

  const selectedBook = books.find((b) => b.id === selectedBookId) ?? null;

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

          {/* ── BOOK TAB ── */}
          <TabsContent value="book" className="space-y-4 mt-4">

            {/* Step 1: Books list */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">1 — Seleziona o crea un libro</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setShowCreateBook((v) => !v)}
                  >
                    {showCreateBook ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showCreateBook ? "Annulla" : "Nuovo libro"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Create book inline form */}
                {showCreateBook && (
                  <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
                    <p className="text-sm font-medium">Nuovo libro</p>
                    <Field label="Titolo">
                      <Input
                        value={newBookTitle}
                        onChange={(e) => setNewBookTitle(e.target.value)}
                        placeholder="es. Bramanti Pagani Salsa — Analisi Matematica 1"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Materia">
                        <NativeSelect value={newBookSubject} onChange={setNewBookSubject}
                          options={SUBJECTS.map((s) => ({ id: s.id, name: s.name }))} />
                      </Field>
                      <Field label="Tipo">
                        <NativeSelect value={newBookDocType} onChange={setNewBookDocType}
                          options={[
                            { id: "libro_teoria", name: "Libro di teoria" },
                            { id: "eserciziario", name: "Eserciziario" },
                          ]} />
                      </Field>
                      <Field label="Ingegneria">
                        <NativeSelect value={newBookEngineering} onChange={setNewBookEngineering}
                          options={ENGINEERING_OPTIONS.map((e) => ({ id: e, name: e }))} />
                      </Field>
                      <Field label="Scaglione">
                        <NativeSelect value={newBookSection} onChange={setNewBookSection}
                          options={SECTIONS.map((s) => ({ id: s, name: s === "tutti" ? "Tutti" : `Scaglione ${s}` }))} />
                      </Field>
                    </div>
                    <Button onClick={createBook} disabled={!newBookTitle || creatingBook} className="w-full">
                      {creatingBook ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creazione...</> : "Crea libro"}
                    </Button>
                  </div>
                )}

                {/* Books list */}
                {loadingBooks ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : books.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nessun libro ancora. Creane uno con il pulsante qui sopra.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {books.map((book) => (
                      <button
                        key={book.id}
                        onClick={() => { setSelectedBookId(book.id); setChapterStatus("idle"); setChapterMsg(""); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                          selectedBookId === book.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-muted/30"
                        )}
                      >
                        <Library className={cn("h-4 w-4 shrink-0", selectedBookId === book.id ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{book.title}</p>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">{book.subject}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{book.doc_type === "libro_teoria" ? "teoria" : "esercizi"}</span>
                            {book.engineering !== "tutti" && <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{book.engineering}</span>
                            </>}
                          </div>
                        </div>
                        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-opacity", selectedBookId === book.id ? "opacity-100 text-primary" : "opacity-0")} />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Add chapter */}
            {selectedBook && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">2 — Aggiungi capitolo</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Libro: <span className="font-medium text-foreground">{selectedBook.title}</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Titolo capitolo">
                    <Input
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      placeholder="es. Capitolo 3 — Derivate — Parte 1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Includi &quot;Parte 1&quot;, &quot;Parte 2&quot; nel titolo se il capitolo è diviso in più PDF.
                    </p>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="N° capitolo (opzionale)">
                      <Input
                        type="number"
                        value={chapterIndex}
                        onChange={(e) => setChapterIndex(e.target.value)}
                        placeholder="es. 3"
                      />
                    </Field>
                    <Field label="Totale capitoli (opzionale)">
                      <Input
                        type="number"
                        value={totalChapters}
                        onChange={(e) => setTotalChapters(e.target.value)}
                        placeholder="es. 12"
                      />
                    </Field>
                  </div>

                  <FileUploadZone file={chapterFile} onChange={setChapterFile} />

                  <StatusBanner status={chapterStatus} message={chapterMsg} />

                  <Button
                    className="w-full"
                    onClick={handleChapterUpload}
                    disabled={!chapterFile || !chapterTitle || chapterStatus === "uploading" || chapterStatus === "processing"}
                  >
                    {chapterStatus === "uploading" || chapterStatus === "processing"
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {chapterStatus === "uploading" ? "Caricamento..." : "Claude sta leggendo..."}
                        </>
                      : <><Upload className="h-4 w-4 mr-2" />Carica e processa capitolo</>}
                  </Button>
                </CardContent>
              </Card>
            )}
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
