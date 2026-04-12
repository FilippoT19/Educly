"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { identifyUser, trackUserLoggedIn, trackGuestLogin } from "@/lib/posthog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email o password non corretti.");
      setLoading(false);
      return;
    }
    if (data.user) {
      identifyUser(data.user.id, data.user.email);
      trackUserLoggedIn({ email: data.user.email ?? "" });
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError("");
    const res = await fetch("/api/auth/guest", { method: "POST" });
    if (!res.ok) {
      setError("Account ospite non disponibile al momento.");
      setGuestLoading(false);
      return;
    }
    const { access_token, refresh_token } = await res.json();
    const supabase = createClient();
    await supabase.auth.setSession({ access_token, refresh_token });
    trackGuestLogin();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-[340px]">

        {/* Wordmark */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-[26px] font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Educly
          </Link>
          <p className="text-[14px] text-muted-foreground mt-1">Accedi al tuo account</p>
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

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={loading || guestLoading}>
            {loading ? "Accesso in corso…" : "Accedi"}
          </Button>
        </form>

        <p className="text-[13px] text-center text-muted-foreground mt-5">
          Non hai un account?{" "}
          <Link href="/signup" className="text-primary hover:underline underline-offset-4">
            Registrati
          </Link>
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">oppure</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Guest */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGuest}
          disabled={loading || guestLoading}
        >
          {guestLoading ? "Accesso…" : "Entra come ospite"}
        </Button>
        <p className="text-[11px] text-center text-muted-foreground mt-2">
          Modalità demo · senza correzione AI
        </p>
      </div>
    </main>
  );
}
