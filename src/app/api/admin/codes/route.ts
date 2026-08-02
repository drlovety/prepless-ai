import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 to avoid confusion
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Hardcoded admin emails (temporary until user_settings table exists)
const ADMIN_EMAILS = ["ty.snohomish@gmail.com"];

function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// POST /api/admin/codes — generate new access code(s) (OLD schema: code, credits, used)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") || "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify caller is admin via email
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(userData.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 50);
  const creditsPerCode = Math.max(parseInt(body.credits_per_use) || 10, 1);

  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    let code = generateCode(8);
    let attempts = 0;

    // Retry on collision
    while (attempts < 5) {
      const { error: insertErr } = await supabase.from("access_codes").insert({
        code,
        credits: creditsPerCode,
        used: false,
      });

      if (!insertErr) {
        codes.push(code);
        break;
      }

      code = generateCode(8);
      attempts++;
    }
  }

  return NextResponse.json({ success: true, codes, count: codes.length });
}

// GET /api/admin/codes — list recent access codes (OLD schema)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") || "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(userData.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("access_codes")
    .select("id, code, credits, used, used_by, used_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codes: data ?? [] });
}
