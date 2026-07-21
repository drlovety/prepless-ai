"use server";

import { createClient } from "@/lib/supabase-server";

export async function sendMagicLink(email: string) {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://prepless-ai-production.up.railway.app";

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
