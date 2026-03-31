import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) return unauthorized();
  const { id } = await params;
  const body = await request.json();

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .update({
      question_latex: body.question_latex,
      solution_latex: body.solution_latex,
      difficulty: body.difficulty,
      engineering: body.engineering,
      section: body.section,
      hints: body.hints,
      tags: body.tags,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) return unauthorized();
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase.from("exercises").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
