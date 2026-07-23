import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("user_settings")
    .select("is_admin")
    .eq("user_id", userId)
    .single();
  return !!data?.is_admin;
}

export async function requireAdmin(userId: string | null | undefined): Promise<void> {
  if (!userId) throw new Error("Unauthorized");
  const admin = await isAdmin(userId);
  if (!admin) throw new Error("Forbidden — admin only");
}
