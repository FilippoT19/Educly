"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function GuestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    const email    = process.env.NEXT_PUBLIC_GUEST_EMAIL;
    const password = process.env.NEXT_PUBLIC_GUEST_PASSWORD;
    if (!email || !password) {
      setError("Account ospite non configurato.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError("Account ospite non disponibile al momento.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 h-9 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
      >
        {loading ? "Accesso…" : "Entra come ospite"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
