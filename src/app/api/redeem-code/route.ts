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

  // 1. Fetch the access code
  const { data: codeRecord, error: codeError } = await supabase
    .from("access_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .gt("remaining_uses", 0)
    .single();

  if (codeError || !codeRecord) {
    return NextResponse.json({ success: false, error: "Invalid or exhausted code" }, { status: 400 });
  }

  // 2. Atomically decrement uses
  const { error: decrError } = await supabase
    .rpc("decrement_code_uses", { code_input: code.toUpperCase() });

  if (decrError) {
    return NextResponse.json({ success: false, error: "Code already exhausted" }, { status: 400 });
  }

  // 3. Add credits to user
  const creditAmount = codeRecord.credits_per_use ?? 1;
  const { error: creditError } = await supabase
    .rpc("add_user_credits", { user_id_input: user_id, amount: creditAmount });

  if (creditError) {
    return NextResponse.json({ success: false, error: "Failed to apply credits" }, { status: 500 });
  }

  // 4. Get updated total
  const { data: credits } = await supabase
    .from("user_credits")
    .select("remaining_credits")
    .eq("user_id", user_id)
    .single();

  return NextResponse.json({
    success: true,
    remaining_credits: credits?.remaining_credits ?? creditAmount,
  });
}
