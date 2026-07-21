import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const checks: Record<string, boolean | string> = {};

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Supabase
  checks.supabase_url = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  checks.supabase_anon_key = (anonKey && anonKey.length > 100) || "missing/short";
  checks.supabase_service_key = (serviceKey && serviceKey.length > 100) || "missing/short";

  // OpenRouter
  checks.openrouter_key = !!process.env.OPENROUTER_API_KEY;

  // App URL
  checks.app_url = process.env.NEXT_PUBLIC_APP_URL || "not set";

  // Headers (check proxy awareness)
  checks.x_forwarded_host = req.headers.get("x-forwarded-host") || "not present (direct request)";
  checks.x_forwarded_proto = req.headers.get("x-forwarded-proto") || "not present (direct request)";

  const allOk =
    checks.supabase_url === true &&
    checks.supabase_anon_key === true &&
    checks.supabase_service_key === true &&
    checks.openrouter_key === true;

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), checks },
    { status: allOk ? 200 : 503 }
  );
}
