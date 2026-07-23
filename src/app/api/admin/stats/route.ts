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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  // Total users
  const { count: totalUsers } = await supabase.schema("auth").from("users").select("*", { count: "exact", head: true });

  // New users today
  const { count: newUsersToday } = await supabase
    .schema("auth").from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  // New users this week
  const { count: newUsersThisWeek } = await supabase
    .schema("auth").from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekStart.toISOString());

  // Credits in circulation
  const { data: creditsData } = await supabase.from("user_credits").select("remaining_credits");
  const totalCredits = (creditsData ?? []).reduce((sum, r) => sum + (r.remaining_credits ?? 0), 0);

  // Credits distributed (redemptions + purchases)
  const { data: distributedData } = await supabase
    .from("credit_transactions")
    .select("amount")
    .in("type", ["redemption", "purchase"]);
  const totalCreditsDistributed = (distributedData ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);

  // Total lessons
  const { count: totalLessons } = await supabase.from("lessons").select("*", { count: "exact", head: true });

  // Generations today
  const { count: generationsToday } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  // Generations this week
  const { count: generationsThisWeek } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekStart.toISOString());

  // Pending
  const { count: pendingGenerations } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // Failed
  const { count: failedGenerations } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");

  // Errors today / this week
  const { count: totalErrorsToday } = await supabase
    .from("llm_errors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  const { count: totalErrorsThisWeek } = await supabase
    .from("llm_errors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekStart.toISOString());

  // Avg generation time (lessons with both started_at and completed_at)
  const { data: timesData } = await supabase
    .from("lessons")
    .select("started_at, completed_at")
    .not("started_at", "is", null)
    .not("completed_at", "is", null);

  let avgGenerationTimeMin: number | null = null;
  if (timesData && timesData.length > 0) {
    const totalSeconds = timesData.reduce((sum, row) => {
      const s = new Date(row.started_at).getTime();
      const c = new Date(row.completed_at).getTime();
      return sum + (c - s) / 1000;
    }, 0);
    avgGenerationTimeMin = totalSeconds / timesData.length / 60;
  }

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    newUsersToday: newUsersToday ?? 0,
    newUsersThisWeek: newUsersThisWeek ?? 0,
    totalCredits,
    totalCreditsDistributed,
    totalLessons: totalLessons ?? 0,
    generationsToday: generationsToday ?? 0,
    generationsThisWeek: generationsThisWeek ?? 0,
    pendingGenerations: pendingGenerations ?? 0,
    failedGenerations: failedGenerations ?? 0,
    totalErrorsToday: totalErrorsToday ?? 0,
    totalErrorsThisWeek: totalErrorsThisWeek ?? 0,
    avgGenerationTimeMin,
  });
}
