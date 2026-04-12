"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { identifyUser, trackUserLoggedIn, trackGuestLogin, trackUserSignedUp } from "@/lib/posthog";
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

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
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

        {/* Google */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={loading || guestLoading}
        >
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continua con Google
        </Button>

        <div className="flex items-center gap-3 my-4">
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
