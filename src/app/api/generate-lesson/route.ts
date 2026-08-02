import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { burnCredits, addCredits, getRemainingCredits } from "@/lib/credits";
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

  // ── 1. Check admin (bypass credits) or burn credit ──
  const admin = await isAdmin(user_id);
  let creditsUsed = 1;
  let creditDataAfterBurn: number | null = null;

  if (!admin) {
    const burned = await burnCredits(user_id, 1);
    if (!burned) {
      return NextResponse.json(
        { error: "Insufficient credits. Add an access code or purchase more." },
        { status: 402 }
      );
    }

    creditDataAfterBurn = await getRemainingCredits(user_id);
  } else {
    creditsUsed = 0; // admin generates for free
  }

  // ── 2. Create lesson row (pending) ──
  const { data: lessonRow, error: insertErr } = await supabase
    .from("lessons")
    .insert({
      user_id,
      status: "pending",
      class_name: config.class_name,
      topic: config.topic || "",
      source_text: source_text,
      credits_used: creditsUsed,
    })
    .select("id")
    .single();

  if (insertErr || !lessonRow) {
    // Refund the credit (only if credits were actually used)
    if (creditsUsed > 0) {
      await addCredits(user_id, creditsUsed);
      // Log the refund
      try {
        const refundBalance = await getRemainingCredits(user_id);
        await supabase.from("credit_transactions").insert({
          user_id: user_id,
          type: "refund",
          amount: creditsUsed,
          balance_after: refundBalance,
          description: `Refunded — failed to create lesson record: ${config.topic || config.class_name}`,
        });
      } catch {}
    }
    return NextResponse.json({ error: "Failed to create lesson record" }, { status: 500 });
  }

  // Log the debit transaction now that lesson row exists (only for non-admins)
  if (creditsUsed > 0 && creditDataAfterBurn !== null) {
    try {
      await supabase.from("credit_transactions").insert({
        user_id: user_id,
        type: "debit",
        amount: creditsUsed,
        balance_after: creditDataAfterBurn,
        description: `Lesson generated: ${config.topic || config.class_name}`,
        lesson_id: lessonRow.id,
      });
    } catch (txErr) {
      console.error("[api/generate-lesson] Failed to log debit transaction:", txErr);
    }
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
