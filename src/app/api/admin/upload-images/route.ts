import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;
const BUCKET = "exercise-images";

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const sourceDocumentId = formData.get("sourceDocumentId") as string;
  if (!sourceDocumentId) {
    return NextResponse.json({ error: "Missing sourceDocumentId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const imageUrls: Record<string, string> = {};

  const files = formData.getAll("images") as File[];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const path = `${sourceDocumentId}/${file.name}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${file.name}:`, error.message);
      continue;
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Store under both bare name and images/name to match LaTeX patterns
    imageUrls[file.name] = publicUrl;
    imageUrls[`images/${file.name}`] = publicUrl;
  }

  return NextResponse.json({ imageUrls });
}
