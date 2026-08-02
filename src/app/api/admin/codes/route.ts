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

// POST /api/admin/codes — generate new access code(s)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") || "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify caller is admin
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("is_admin")
    .eq("user_id", userData.user.id)
    .single();

  if (!settings?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 50);
  const creditsPerUse = Math.max(parseInt(body.credits_per_use) || 10, 1);
  const totalUses = Math.max(parseInt(body.total_uses) || 1, 1);
  const expiresAt = body.expires_at || null;

  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    let code = generateCode(8);
    let attempts = 0;

    // Retry on collision
    while (attempts < 5) {
      const { error: insertErr } = await supabase.from("access_codes").insert({
        code,
        total_uses: totalUses,
        remaining_uses: totalUses,
        credits_per_use: creditsPerUse,
        created_by: userData.user.id,
        expires_at: expiresAt,
      });

      if (!insertErr) {
        codes.push(code);
        break;
      }

      // Collision or other error — try a new code
      code = generateCode(8);
      attempts++;
    }
  }

  return NextResponse.json({ success: true, codes, count: codes.length });
}

// GET /api/admin/codes — list recent access codes
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

  const { data: settings } = await supabase
    .from("user_settings")
    .select("is_admin")
    .eq("user_id", userData.user.id)
    .single();

  if (!settings?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("access_codes")
    .select("id, code, total_uses, remaining_uses, credits_per_use, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codes: data ?? [] });
}
