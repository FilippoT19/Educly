import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { fullName, email, password, course, year } = await request.json();
  if (!fullName || !email || !password || !course || !year) {
    return NextResponse.json({ error: "Campi mancanti" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Errore nella creazione utente" }, { status: 500 });
  }

  // Create student profile
  const { error: profileError } = await admin.from("students").insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    school: "politecnico",
    course,
    year,
  });

  if (profileError) {
    // Rollback: delete the auth user we just created
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: authData.user.id });
}
