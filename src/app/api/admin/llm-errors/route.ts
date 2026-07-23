import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  try {
    await requireAdmin(user?.id);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: user ? 403 : 401 });
  }

  const supabase = getSupabase();
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const errorType = url.searchParams.get("error_type");

  let query = supabase
    .from("llm_errors")
    .select("id, lesson_id, user_id, error_type, error_message, attempt_number, model_used, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (errorType) query = query.eq("error_type", errorType);

  const { data: errors, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get user emails
  const userIds = [...new Set((errors ?? []).map((e: any) => e.user_id))];
  const { data: authUsers } = await supabase
    .schema("auth")
    .from("users")
    .select("id, email")
    .in("id", userIds);

  const emailMap = new Map((authUsers ?? []).map((u: any) => [u.id, u.email]));

  const enriched = (errors ?? []).map((e: any) => ({
    ...e,
    user_email: emailMap.get(e.user_id) ?? "unknown",
  }));

  return NextResponse.json({ errors: enriched });
}
