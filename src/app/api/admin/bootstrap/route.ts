import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/admin/bootstrap
// One-time: promote the currently logged-in user to admin
// Only works if there are currently zero admins in the system.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") || "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify the user
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if any admin already exists
  const { data: existingAdmins } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("is_admin", true)
    .limit(1);

  if (existingAdmins && existingAdmins.length > 0) {
    return NextResponse.json(
      { error: "Admin already exists. Contact them for access." },
      { status: 403 }
    );
  }

  // Promote this user to admin
  const { error: updateErr } = await supabase
    .from("user_settings")
    .update({ is_admin: true })
    .eq("user_id", userData.user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "You are now the admin.",
    user_id: userData.user.id,
  });
}
