import { startLessonWorker } from "@/lib/queue";
import { processLessonJob } from "@/lib/worker";

export async function register() {
  // Start the BullMQ worker for background lesson generation.
  // This runs once when the Next.js process starts (Railway container),
  // not per-request.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startLessonWorker(processLessonJob);
  }
}
