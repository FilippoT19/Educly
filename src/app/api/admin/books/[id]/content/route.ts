import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("source_documents")
    .select("doc_type")
    .eq("id", id)
    .single();

  if (doc?.doc_type === "libro_teoria") {
    const { data } = await supabase
      .from("theory_lessons")
      .select("id, lesson_order, title, topic_id")
      .eq("source_document_id", id)
      .order("lesson_order", { ascending: true });
    return NextResponse.json({ type: "lessons", items: data ?? [] });
  } else {
    const { data } = await supabase
      .from("exercises")
      .select("id, topic_id, difficulty, question_latex, created_at")
      .eq("source_document_id", id)
      .order("created_at", { ascending: true });
    return NextResponse.json({ type: "exercises", items: data ?? [] });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { itemId, itemType } = await request.json();
  const supabase = createAdminClient();

  const table = itemType === "lesson" ? "theory_lessons" : "exercises";
  const { error } = await supabase.from(table).delete().eq("id", itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
