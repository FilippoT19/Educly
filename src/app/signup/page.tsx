"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COURSES = [
  "Ingegneria Informatica",
  "Ingegneria Elettronica",
  "Ingegneria Meccanica",
  "Ingegneria Civile",
  "Ingegneria Energetica",
  "Ingegneria Chimica",
  "Ingegneria Aerospaziale",
  "Ingegneria Biomedica",
  "Ingegneria Matematica",
  "Ingegneria Fisica",
  "Architettura",
  "Design",
  "Altro",
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    course: "",
    year: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.course || !form.year) {
      setError("Seleziona il corso e l'anno.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: signupError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signupError || !data.user) {
      setError(signupError?.message || "Errore durante la registrazione.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("students").insert({
      id: data.user.id,
      email: form.email,
      full_name: form.fullName,
      school: "politecnico",
      course: form.course,
      year: parseInt(form.year),
    });

    if (profileError) {
      setError("Errore nel salvare il profilo. Riprova.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Crea account</CardTitle>
          <CardDescription>
            Inizia ad allenarti con esercizi corretti dall&apos;AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="fullName">Nome e cognome</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => updateForm("fullName", e.target.value)}
                placeholder="Mario Rossi"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                placeholder="mario@polimi.it"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                placeholder="Almeno 8 caratteri"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Scuola</Label>
              <Input value="Politecnico" disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="course">Corso di laurea</Label>
              <select
                id="course"
                value={form.course}
                onChange={(e) => updateForm("course", e.target.value)}
                required
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  !form.course && "text-muted-foreground"
                )}
              >
                <option value="" disabled>Seleziona il corso</option>
                {COURSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="year">Anno</Label>
              <select
                id="year"
                value={form.year}
                onChange={(e) => updateForm("year", e.target.value)}
                required
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  !form.year && "text-muted-foreground"
                )}
              >
                <option value="" disabled>Seleziona l&apos;anno</option>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={String(y)}>{y}° anno</option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registrazione..." : "Crea account"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Hai già un account?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Accedi
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
