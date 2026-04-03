import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  const topicIds = searchParams.getAll("topicId"); // supports multiple
  const tag = searchParams.get("tag");

  if (!subject) return NextResponse.json({ error: "Missing subject" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabase
    .from("exercises")
    .select("id, topic_id, difficulty, source, question_latex, solution_latex, hints, tags")
    .eq("subject", subject)
    .order("difficulty", { ascending: true });

  if (topicIds.length > 0) {
    query = query.in("topic_id", topicIds);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ exercises: data || [] });
}
