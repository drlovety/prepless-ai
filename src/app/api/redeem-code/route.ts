import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, user_id } = body;

  if (!code || !user_id) {
    return NextResponse.json({ success: false, error: "Missing code or user ID" }, { status: 400 });
  }

  // Service role client for atomic server-side operation
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const upperCode = code.toUpperCase().trim();

  // 1. Fetch an unused code (remaining_uses > 0 and not expired)
  const { data: codeRecord, error: codeError } = await supabase
    .from("access_codes")
    .select("id, code, remaining_uses, credits_per_use, expires_at")
    .eq("code", upperCode)
    .gt("remaining_uses", 0)
    .or("expires_at.is.null,expires_at.gte.now()")
    .single();

  if (codeError || !codeRecord) {
    return NextResponse.json({ success: false, error: "Invalid, expired, or already used code" }, { status: 400 });
  }

  const creditAmount = codeRecord.credits_per_use ?? 1;

  // 2. Decrement remaining_uses atomically via RPC
  const { error: rpcError } = await supabase.rpc("decrement_code_uses", {
    code_input: upperCode,
  });

  if (rpcError) {
    return NextResponse.json({ success: false, error: "Failed to redeem code — it may have just been used" }, { status: 500 });
  }

  // 3. Add credits to user via RPC (upsert with addition)
  const { error: creditError } = await supabase.rpc("add_user_credits", {
    user_id_input: user_id,
    amount: creditAmount,
  });

  if (creditError) {
    // Rollback: try to restore the use count
    await supabase
      .from("access_codes")
      .update({ remaining_uses: codeRecord.remaining_uses })
      .eq("id", codeRecord.id);
    return NextResponse.json({ success: false, error: "Failed to apply credits" }, { status: 500 });
  }

  // 4. Get updated total
  const { data: credits } = await supabase
    .from("user_credits")
    .select("remaining_credits")
    .eq("user_id", user_id)
    .single();

  // 5. Log redemption transaction
  try {
    await supabase.from("credit_transactions").insert({
      user_id: user_id,
      type: "redemption",
      amount: creditAmount,
      balance_after: credits?.remaining_credits ?? creditAmount,
      description: `Code redeemed: ${upperCode}`,
    });
  } catch (txErr) {
    console.error("[redeem-code] Failed to log redemption transaction:", txErr);
  }

  return NextResponse.json({
    success: true,
    remaining_credits: credits?.remaining_credits ?? creditAmount,
  });
}
