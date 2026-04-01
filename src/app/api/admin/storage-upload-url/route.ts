import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await request.json();
  const path = `admin/${Date.now()}-${String(filename).replace(/[^a-z0-9.]/gi, "_")}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("tmp-pdfs")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create signed URL" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path });
}
