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
  const statusFilter = url.searchParams.get("status");

  let query = supabase
    .from("lessons")
    .select("id, user_id, status, class_name, topic, credits_used, created_at, started_at, completed_at, error_message, error_type")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: lessons, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get user emails
  const userIds = [...new Set((lessons ?? []).map((l: any) => l.user_id))];
  const { data: authUsers } = await supabase
    .schema("auth")
    .from("users")
    .select("id, email")
    .in("id", userIds);

  const emailMap = new Map((authUsers ?? []).map((u: any) => [u.id, u.email]));

  const enriched = (lessons ?? []).map((l: any) => ({
    ...l,
    user_email: emailMap.get(l.user_id) ?? "unknown",
  }));

  return NextResponse.json({ lessons: enriched });
}
