"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const COURSES = [
  "Ingegneria Informatica", "Ingegneria Elettronica", "Ingegneria Meccanica",
  "Ingegneria Civile", "Ingegneria Energetica", "Ingegneria Chimica",
  "Ingegneria Aerospaziale", "Ingegneria Biomedica", "Ingegneria Matematica",
  "Ingegneria Fisica", "Architettura", "Design", "Altro",
];

const selectClass = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-[14px]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", course: "", year: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.course || !form.year) { setError("Seleziona il corso e l'anno."); return; }
    setLoading(true);
    const supabase = createClient();
    const { data, error: signupError } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (signupError || !data.user) {
      setError(signupError?.message || "Errore durante la registrazione.");
      setLoading(false);
      return;
    }
    const { error: profileError } = await supabase.from("students").insert({
      id: data.user.id, email: form.email, full_name: form.fullName,
      school: "politecnico", course: form.course, year: parseInt(form.year),
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
    <main className="flex items-center justify-center min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-[340px]">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <p
            className="text-[26px] font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Educly
          </p>
          <p className="text-[14px] text-muted-foreground mt-1">
            Crea il tuo account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-[13px]">Nome e cognome</Label>
            <Input id="fullName" value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)} placeholder="Mario Rossi" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px]">Email</Label>
            <Input id="email" type="email" value={form.email}
              onChange={(e) => update("email", e.target.value)} placeholder="mario@polimi.it" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px]">Password</Label>
            <Input id="password" type="password" value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="Almeno 8 caratteri" minLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="course" className="text-[13px]">Corso di laurea</Label>
            <select id="course" value={form.course}
              onChange={(e) => update("course", e.target.value)} required
              className={cn(selectClass, !form.course && "text-muted-foreground")}
            >
              <option value="" disabled>Seleziona il corso</option>
              {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="year" className="text-[13px]">Anno</Label>
            <select id="year" value={form.year}
              onChange={(e) => update("year", e.target.value)} required
              className={cn(selectClass, !form.year && "text-muted-foreground")}
            >
              <option value="" disabled>Seleziona l&apos;anno</option>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={String(y)}>{y}° anno</option>)}
            </select>
          </div>

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Registrazione…" : "Crea account"}
          </Button>
        </form>

        <p className="text-[13px] text-center text-muted-foreground mt-6">
          Hai già un account?{" "}
          <Link href="/login" className="text-primary hover:underline underline-offset-4">
            Accedi
          </Link>
        </p>
      </div>
    </main>
  );
}
