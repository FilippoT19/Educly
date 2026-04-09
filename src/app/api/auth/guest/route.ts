import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/lib/rateLimit";

// Server-only sign-in for the guest/demo account.
// Credentials live in server-only env vars (no NEXT_PUBLIC_ prefix).
export async function POST(request: Request) {
  // Rate limit by IP to prevent credential-stuffing loops
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`guest:${ip}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste." }, { status: 429 });
  }

  const email    = process.env.GUEST_EMAIL;
  const password = process.env.GUEST_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "Account guest non configurato." }, { status: 503 });
  }

  // Use a plain (non-SSR) client — we only need the tokens, the browser will set the session
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: "Login guest fallito." }, { status: 500 });
  }

  return NextResponse.json({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
