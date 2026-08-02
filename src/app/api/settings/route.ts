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

const DEFAULT_SETTINGS = {
  school_name: "Cascade High School",
  mascot: "Bruins",
  city: "Everett",
  state: "WA",
  primary_color: "#8B0000",
  secondary_color: "#FFD700",
  default_duration: "50",
  default_rigor: "standard",
  include_journal: true,
  include_exit_ticket: true,
  include_essential_questions: true,
  include_handouts: true,
  include_card_sets: false,
  class_configs: {},
};

// GET /api/settings → fetch user settings (returns hardcoded defaults until table exists)
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // user_settings table doesn't exist yet — return defaults
  return NextResponse.json({ settings: DEFAULT_SETTINGS });
}

// POST /api/settings → update user settings (no-op until table exists)
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Merge with defaults
  const merged = { ...DEFAULT_SETTINGS, ...body };

  // user_settings table doesn't exist yet — return merged defaults
  return NextResponse.json({ settings: merged });
}
