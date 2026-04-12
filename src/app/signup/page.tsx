"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { identifyUser, trackUserSignedUp, trackSignupFailed } from "@/lib/posthog";
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

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
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
      trackSignupFailed({ reason: signupError?.message || "auth_error" });
      setLoading(false);
      return;
    }
    const { error: profileError } = await supabase.from("students").insert({
      id: data.user.id, email: form.email, full_name: form.fullName,
      school: "politecnico", course: form.course, year: parseInt(form.year),
    });
    if (profileError) {
      setError("Errore nel salvare il profilo. Riprova.");
      trackSignupFailed({ reason: "profile_creation_error" });
      setLoading(false);
      return;
    }
    identifyUser(data.user.id, form.email);
    trackUserSignedUp({ email: form.email, course: form.course, year: parseInt(form.year) });
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
            <Link href="/" className="hover:opacity-80 transition-opacity">Educly</Link>
          </p>
          <p className="text-[14px] text-muted-foreground mt-1">
            Crea il tuo account
          </p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continua con Google
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">oppure</span>
          <div className="flex-1 h-px bg-border" />
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
