import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/exercise/attempts?subject=analisi2
// Returns a map of exerciseId → { tried: boolean, passed: boolean, lastScore: number }
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subject = request.nextUrl.searchParams.get("subject");
  if (!subject) return NextResponse.json({ error: "Missing subject" }, { status: 400 });

  // Get all attempts for exercises in this subject
  const { data, error } = await supabase
    .from("exercise_attempts")
    .select("exercise_id, is_correct, score")
    .eq("student_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate: for each exercise, keep best result
  const map: Record<string, { tried: boolean; passed: boolean; lastScore: number }> = {};
  for (const row of data || []) {
    const existing = map[row.exercise_id];
    if (!existing) {
      map[row.exercise_id] = { tried: true, passed: row.is_correct, lastScore: row.score ?? 0 };
    } else {
      map[row.exercise_id] = {
        tried: true,
        passed: existing.passed || row.is_correct,
        lastScore: Math.max(existing.lastScore, row.score ?? 0),
      };
    }
  }

  return NextResponse.json({ attempts: map });
}

// POST /api/exercise/attempts — record a new attempt
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { exerciseId, isCorrect, score } = await request.json();
  if (!exerciseId || isCorrect === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await supabase.from("exercise_attempts").insert({
    student_id: user.id,
    exercise_id: exerciseId,
    is_correct: isCorrect,
    score: score ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
