"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, CheckCircle, AlertCircle, Loader2, BookOpen, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

interface Result {
  extracted: number;
  message?: string;
}

const SUBJECTS = [
  { id: "analisi1", name: "Analisi 1" },
  { id: "analisi2", name: "Analisi 2" },
];

const EXERCISE_SOURCES = [
  { id: "eserciziario", name: "Eserciziario" },
  { id: "tema_passato", name: "Tema d'esame passato" },
  { id: "dispensa", name: "Dispensa con esercizi" },
];

function FileUploadZone({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
        file ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50 hover:bg-muted/30"
      )}
    >
      <input
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <Upload className={cn("h-6 w-6 mb-2", file ? "text-primary" : "text-muted-foreground")} />
      {file ? (
        <div className="text-center">
          <p className="text-sm font-medium text-primary">{file.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Trascina il PDF o clicca per selezionarlo</p>
          <p className="text-xs text-muted-foreground mt-0.5">Solo file PDF</p>
        </div>
      )}
    </label>
  );
}

function StatusBanner({ status, result }: { status: Status; result: Result | null }) {
  if (status === "idle") return null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border text-sm",
        status === "processing" || status === "uploading"
          ? "bg-blue-50 border-blue-200 text-blue-800"
          : status === "done"
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-800"
      )}
    >
      {status === "processing" || status === "uploading" ? (
        <Loader2 className="h-5 w-5 animate-spin shrink-0" />
      ) : status === "done" ? (
        <CheckCircle className="h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0" />
      )}
      <div>
        {status === "uploading" && "Caricamento in corso..."}
        {status === "processing" && "Claude sta analizzando il PDF... (può richiedere 1-2 minuti)"}
        {status === "done" && result && `Completato! Estratti ${result.extracted} elementi.`}
        {status === "error" && (result?.message || "Errore durante il processing. Riprova.")}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Exercise upload state
  const [exFile, setExFile] = useState<File | null>(null);
  const [exSubject, setExSubject] = useState("analisi1");
  const [exSource, setExSource] = useState("eserciziario");
  const [exTitle, setExTitle] = useState("");
  const [exYear, setExYear] = useState("");
  const [exStatus, setExStatus] = useState<Status>("idle");
  const [exResult, setExResult] = useState<Result | null>(null);

  // Theory upload state
  const [thFile, setThFile] = useState<File | null>(null);
  const [thSubject, setThSubject] = useState("analisi1");
  const [thTitle, setThTitle] = useState("");
  const [thStatus, setThStatus] = useState<Status>("idle");
  const [thResult, setThResult] = useState<Result | null>(null);

  // Documents list
  const [docs, setDocs] = useState<{ title: string; type: string; extracted: number }[]>([]);

  async function handleExerciseUpload() {
    if (!exFile || !exTitle) return;
    setExStatus("uploading");
    setExResult(null);

    const formData = new FormData();
    formData.append("file", exFile);
    formData.append("subject", exSubject);
    formData.append("source", exSource);
    formData.append("title", exTitle);
    if (exYear) formData.append("year", exYear);

    setExStatus("processing");
    try {
      const res = await fetch("/api/admin/process-exercises", {
        method: "POST",
        headers: { "x-admin-secret": secret },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExResult({ extracted: data.extracted });
      setExStatus("done");
      setDocs((prev) => [
        { title: exTitle, type: exSource, extracted: data.extracted },
        ...prev,
      ]);
      setExFile(null);
      setExTitle("");
      setExYear("");
    } catch (err) {
      setExResult({ extracted: 0, message: err instanceof Error ? err.message : "Errore" });
      setExStatus("error");
    }
  }

  async function handleTheoryUpload() {
    if (!thFile || !thTitle) return;
    setThStatus("uploading");
    setThResult(null);

    const formData = new FormData();
    formData.append("file", thFile);
    formData.append("subject", thSubject);
    formData.append("title", thTitle);

    setThStatus("processing");
    try {
      const res = await fetch("/api/admin/process-theory", {
        method: "POST",
        headers: { "x-admin-secret": secret },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThResult({ extracted: data.extracted });
      setThStatus("done");
      setDocs((prev) => [
        { title: thTitle, type: "libro_teoria", extracted: data.extracted },
        ...prev,
      ]);
      setThFile(null);
      setThTitle("");
    } catch (err) {
      setThResult({ extracted: 0, message: err instanceof Error ? err.message : "Errore" });
      setThStatus("error");
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Admin Educly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Password admin</Label>
              <Input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setAuthenticated(true)}
                placeholder="Inserisci la password"
              />
            </div>
            <Button className="w-full" onClick={() => setAuthenticated(true)}>
              Accedi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin — Gestione materiali</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Carica PDF e Claude estrarrà automaticamente esercizi e lezioni
          </p>
        </div>

        <Tabs defaultValue="exercises">
          <TabsList className="w-full">
            <TabsTrigger value="exercises" className="flex-1 gap-2">
              <PenLine className="h-4 w-4" />
              Esercizi
            </TabsTrigger>
            <TabsTrigger value="theory" className="flex-1 gap-2">
              <BookOpen className="h-4 w-4" />
              Teoria
            </TabsTrigger>
          </TabsList>

          {/* EXERCISES TAB */}
          <TabsContent value="exercises" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Carica eserciziario o tema d&apos;esame</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploadZone file={exFile} onChange={setExFile} />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Materia</Label>
                    <select
                      value={exSubject}
                      onChange={(e) => setExSubject(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Tipo documento</Label>
                    <select
                      value={exSource}
                      onChange={(e) => setExSource(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      {EXERCISE_SOURCES.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Titolo documento</Label>
                  <Input
                    value={exTitle}
                    onChange={(e) => setExTitle(e.target.value)}
                    placeholder="es. Eserciziario Bramanti — Capitolo Integrali"
                  />
                </div>

                {exSource === "tema_passato" && (
                  <div className="space-y-1">
                    <Label>Anno esame</Label>
                    <Input
                      type="number"
                      value={exYear}
                      onChange={(e) => setExYear(e.target.value)}
                      placeholder="es. 2023"
                    />
                  </div>
                )}

                <StatusBanner status={exStatus} result={exResult} />

                <Button
                  className="w-full"
                  onClick={handleExerciseUpload}
                  disabled={!exFile || !exTitle || exStatus === "processing" || exStatus === "uploading"}
                >
                  {exStatus === "processing" || exStatus === "uploading" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />Carica e processa</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* THEORY TAB */}
          <TabsContent value="theory" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Carica libro di teoria o dispensa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploadZone file={thFile} onChange={setThFile} />

                <div className="space-y-1">
                  <Label>Materia</Label>
                  <select
                    value={thSubject}
                    onChange={(e) => setThSubject(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Titolo documento</Label>
                  <Input
                    value={thTitle}
                    onChange={(e) => setThTitle(e.target.value)}
                    placeholder="es. Bramanti Pagani Salsa — Analisi Matematica 1"
                  />
                </div>

                <StatusBanner status={thStatus} result={thResult} />

                <Button
                  className="w-full"
                  onClick={handleTheoryUpload}
                  disabled={!thFile || !thTitle || thStatus === "processing" || thStatus === "uploading"}
                >
                  {thStatus === "processing" || thStatus === "uploading" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />Carica e processa</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Processed documents this session */}
        {docs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Caricati in questa sessione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{d.type.replace("_", " ")}</p>
                  </div>
                  <Badge variant="default">
                    {d.extracted} {d.type === "libro_teoria" ? "lezioni" : "esercizi"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
