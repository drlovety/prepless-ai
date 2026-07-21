"use server";

import { createClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export async function sendMagicLink(email: string) {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://prepless-ai-production.up.railway.app";

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  const allCookies = (await cookies()).getAll();
  console.log("[sendMagicLink] cookies after signInWithOtp:", allCookies.map(c => c.name));
  console.log("[sendMagicLink] signInWithOtp result:", { data: !!data, error: error?.message, code: error?.code });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
