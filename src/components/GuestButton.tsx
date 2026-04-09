"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function GuestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/guest", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Errore nel login guest.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.setSession({
      access_token:  json.access_token,
      refresh_token: json.refresh_token,
    });
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
