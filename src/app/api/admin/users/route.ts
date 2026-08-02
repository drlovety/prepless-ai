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

  // Get auth users directly (user_settings table doesn't exist yet)
  const { data: authUsers, error: authErr } = await supabase
    .schema("auth")
    .from("users")
    .select("id, email, created_at, last_sign_in_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  const userIds = (authUsers ?? []).map((u: any) => u.id);

  // Get credits for these users
  const { data: creditsData } = await supabase
    .from("user_credits")
    .select("user_id, remaining_credits")
    .in("user_id", userIds);

  const creditMap = new Map((creditsData ?? []).map((c: any) => [c.user_id, c.remaining_credits]));

  // Get lesson counts for these users (count in JS since group() isn't typed)
  const { data: userLessons } = await supabase
    .from("lessons")
    .select("user_id")
    .in("user_id", userIds);

  const lessonMap = new Map<string, number>();
  for (const l of (userLessons ?? [])) {
    lessonMap.set(l.user_id, (lessonMap.get(l.user_id) || 0) + 1);
  }

  const enriched = (authUsers ?? []).map((u: any) => ({
    id: u.id,
    email: u.email ?? "unknown",
    school_name: "Cascade High School",
    is_admin: false,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    remaining_credits: creditMap.get(u.id) ?? 0,
    total_lessons: lessonMap.get(u.id) ?? 0,
  }));

  return NextResponse.json({ users: enriched });
}
