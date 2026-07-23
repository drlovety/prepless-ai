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

  // Get users with their credit balance and lesson count
  const { data: users, error } = await supabase
    .from("user_settings")
    .select(`
      id, user_id, school_name, is_admin, created_at,
      user_credits!left(remaining_credits),
      lessons(count)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get emails from auth.users for these user_ids
  const userIds = (users ?? []).map((u: any) => u.user_id);
  const { data: authUsers } = await supabase
    .schema("auth")
    .from("users")
    .select("id, email, created_at, last_sign_in_at")
    .in("id", userIds);

  const emailMap = new Map((authUsers ?? []).map((u: any) => [u.id, u]));

  const enriched = (users ?? []).map((u: any) => {
    const auth = emailMap.get(u.user_id);
    return {
      id: u.user_id,
      email: auth?.email ?? "unknown",
      school_name: u.school_name,
      is_admin: u.is_admin,
      created_at: u.created_at,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      remaining_credits: u.user_credits?.remaining_credits ?? 0,
      total_lessons: u.lessons?.count ?? 0,
    };
  });

  return NextResponse.json({ users: enriched });
}
