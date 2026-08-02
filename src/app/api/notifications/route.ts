import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

// GET /api/notifications — list user's notifications (returns empty until table exists)
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // notifications table doesn't exist yet — return empty
  return NextResponse.json({ notifications: [], unread_count: 0 });
}

// POST /api/notifications — mark as read (no-op until table exists)
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // notifications table doesn't exist yet — return success no-op
  return NextResponse.json({ success: true });
}
