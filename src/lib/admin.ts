import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Hardcoded admin emails (temporary until user_settings.is_admin works)
const ADMIN_EMAILS = ["ty.snohomish@gmail.com"];

export async function isAdmin(userId: string): Promise<boolean>;
export async function isAdmin(user: { id: string; email?: string | null }): Promise<boolean>;
export async function isAdmin(userOrId: string | any): Promise<boolean> {
  let email: string | null = null;

  if (typeof userOrId === "string") {
    // Query auth for the user's email
    const supabase = getSupabase();
    const { data } = await supabase.auth.admin.getUserById(userOrId);
    email = data?.user?.email ?? null;
  } else if (userOrId && typeof userOrId === "object") {
    email = userOrId.email ?? null;
  }

  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(userId: string | null | undefined): Promise<void> {
  if (!userId) throw new Error("Unauthorized");
  const admin = await isAdmin(userId);
  if (!admin) throw new Error("Forbidden — admin only");
}
