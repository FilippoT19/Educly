"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email o password non corretti.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGuest() {
    const guestEmail    = process.env.NEXT_PUBLIC_GUEST_EMAIL;
    const guestPassword = process.env.NEXT_PUBLIC_GUEST_PASSWORD;
    if (!guestEmail || !guestPassword) {
      setError("Account demo non configurato.");
      return;
    }
    setError("");
    setGuestLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: guestEmail,
      password: guestPassword,
    });
    if (error) {
      setError("Account demo non disponibile al momento.");
      setGuestLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-background px-4">
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
            Accedi al tuo account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px]">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mario@polimi.it"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px]">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading || guestLoading}>
            {loading ? "Accesso in corso…" : "Accedi"}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[12px] text-muted-foreground">oppure</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Guest login */}
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          onClick={handleGuest}
          disabled={loading || guestLoading}
        >
          {guestLoading ? "Accesso…" : "Entra come ospite"}
        </Button>
        <p className="text-[11px] text-center text-muted-foreground mt-2">
          Account demo — Ing. Fisica, 2° anno
        </p>

        <p className="text-[13px] text-center text-muted-foreground mt-6">
          Non hai un account?{" "}
          <Link href="/signup" className="text-primary hover:underline underline-offset-4">
            Registrati
          </Link>
        </p>
      </div>
    </main>
  );
}
