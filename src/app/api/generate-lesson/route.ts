import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addJobInlineOrQueued } from "@/lib/queue";
import { processLessonJob } from "@/lib/worker";

// Start the background worker when this module first loads (lazy, idempotent)
import { startLessonWorker } from "@/lib/queue";
startLessonWorker(processLessonJob);

// ── API Route ──
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, source_text, config } = body;
  if (!user_id || !source_text || !config?.class_name) {
    return NextResponse.json({ error: "Missing user_id, source_text, or class_name" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 1. Burn credit atomically ──
  const { data: burned, error: burnErr } = await supabase.rpc("burn_credit", {
    user_id_input: user_id,
    amount: 1,
  });

  if (burnErr || !burned) {
    return NextResponse.json(
      { error: "Insufficient credits. Add an access code or purchase more." },
      { status: 402 }
    );
  }

  // Get current balance for transaction log
  const { data: creditDataAfterBurn } = await supabase
    .from("user_credits")
    .select("remaining_credits")
    .eq("user_id", user_id)
    .single();

  // ── 2. Create lesson row (pending) ──
  const { data: lessonRow, error: insertErr } = await supabase
    .from("lessons")
    .insert({
      user_id,
      status: "pending",
      class_name: config.class_name,
      topic: config.topic || "",
      source_text: source_text,
      credits_used: 1,
    })
    .select("id")
    .single();

  if (insertErr || !lessonRow) {
    // Refund the credit
    await supabase.rpc("add_user_credits", { user_id_input: user_id, amount: 1 });
    // Log the refund
    try {
      const { data: refundCreditData } = await supabase
        .from("user_credits")
        .select("remaining_credits")
        .eq("user_id", user_id)
        .single();
      await supabase.from("credit_transactions").insert({
        user_id: user_id,
        type: "refund",
        amount: 1,
        balance_after: (refundCreditData?.remaining_credits ?? 0) + 1,
        description: `Refunded — failed to create lesson record: ${config.topic || config.class_name}`,
      });
    } catch {}
    return NextResponse.json({ error: "Failed to create lesson record" }, { status: 500 });
  }

  // Log the debit transaction now that lesson row exists
  try {
    await supabase.from("credit_transactions").insert({
      user_id: user_id,
      type: "debit",
      amount: 1,
      balance_after: creditDataAfterBurn?.remaining_credits ?? 0,
      description: `Lesson generated: ${config.topic || config.class_name}`,
      lesson_id: lessonRow.id,
    });
  } catch (txErr) {
    console.error("[api/generate-lesson] Failed to log debit transaction:", txErr);
  }

  // ── 3. Enqueue (or run inline if no Redis) ──
  const queueResult = await addJobInlineOrQueued(
    {
      lessonId: lessonRow.id,
      userId: user_id,
      sourceText: source_text,
      config,
    },
    processLessonJob
  );

  return NextResponse.json({
    success: true,
    lesson_id: lessonRow.id,
    status: "pending",
    queued: queueResult.queued,
    message: queueResult.queued
      ? "Your lesson is being generated. You'll be notified when it's ready."
      : "Your lesson is being generated (inline mode). You'll be notified when it's ready.",
  });
}
