import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/redeem-code — redeem an access code (OLD schema: used boolean + credits int)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, user_id } = body;

  if (!code || !user_id) {
    return NextResponse.json({ success: false, error: "Missing code or user ID" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const upperCode = code.toUpperCase().trim();

  // OLD schema: used boolean + credits int
  const { data: codeRecord, error: codeError } = await supabase
    .from("access_codes")
    .select("id, code, credits, used")
    .eq("code", upperCode)
    .eq("used", false)
    .single();

  if (codeError || !codeRecord) {
    return NextResponse.json({ success: false, error: "Invalid or already used code" }, { status: 400 });
  }

  const creditAmount = codeRecord.credits ?? 1;

  // Mark code as used (OLD schema)
  const { error: updateError } = await supabase
    .from("access_codes")
    .update({ used: true, used_by: user_id, used_at: new Date().toISOString() })
    .eq("code", upperCode);

  if (updateError) {
    return NextResponse.json({ success: false, error: "Failed to redeem code" }, { status: 500 });
  }

  // Add credits to user (manual upsert — RPC functions don't exist yet)
  const { data: existingCredits } = await supabase
    .from("user_credits")
    .select("remaining_credits")
    .eq("user_id", user_id)
    .single();

  let newBalance: number;
  if (existingCredits) {
    newBalance = (existingCredits.remaining_credits ?? 0) + creditAmount;
    const { error: updErr } = await supabase
      .from("user_credits")
      .update({ remaining_credits: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", user_id);
    if (updErr) {
      // Rollback code
      await supabase.from("access_codes").update({ used: false, used_by: null, used_at: null }).eq("code", upperCode);
      return NextResponse.json({ success: false, error: "Failed to apply credits" }, { status: 500 });
    }
  } else {
    newBalance = creditAmount;
    const { error: insErr } = await supabase.from("user_credits").insert({
      user_id,
      remaining_credits: creditAmount,
      total_purchased: 0,
    });
    if (insErr) {
      // Rollback code
      await supabase.from("access_codes").update({ used: false, used_by: null, used_at: null }).eq("code", upperCode);
      return NextResponse.json({ success: false, error: "Failed to apply credits" }, { status: 500 });
    }
  }

  // Log redemption transaction
  try {
    await supabase.from("credit_transactions").insert({
      user_id: user_id,
      type: "redemption",
      amount: creditAmount,
      balance_after: newBalance,
      description: `Code redeemed: ${upperCode}`,
    });
  } catch (txErr) {
    console.error("[redeem-code] Failed to log redemption transaction:", txErr);
  }

  return NextResponse.json({
    success: true,
    remaining_credits: newBalance,
  });
}
