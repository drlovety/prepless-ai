import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Use x-forwarded headers to get the real origin behind Railway proxy
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin;

  if (code) {
    const supabase = await createClient();
    const cookieStore = await cookies();
    console.log("[auth/callback] cookies on callback:", cookieStore.getAll().map(c => c.name));
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Log the actual error for debugging
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message, "| code:", error.code, "| origin:", origin);
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.code || "auth_failed")}&msg=${encodeURIComponent(error.message.slice(0, 200))}`);
  }

  return NextResponse.redirect(`${origin}/?error=no_code`);
}
