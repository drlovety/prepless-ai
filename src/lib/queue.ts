import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || process.env.REDISHOST;

function createRedisConnection() {
  if (!REDIS_URL) {
    return null;
  }
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

const redisConn = createRedisConnection();

export const lessonQueue = redisConn
  ? new Queue("lesson-generation", { connection: redisConn })
  : null;

export function getQueueStatus() {
  if (!lessonQueue) return "no-redis";
  return "ready";
}

// ── Worker ──
// The worker is initialized lazily when this module is first imported in
// a long-lived process (e.g. Railway container, not serverless).
let worker: Worker | null = null;

export function startLessonWorker(processor: (job: Job) => Promise<void>) {
  if (!redisConn) {
    console.warn("[queue] REDIS_URL not set — lesson worker will NOT run. Generation falls back to fire-and-forget.");
    return null;
  }
  if (worker) {
    return worker;
  }

  worker = new Worker("lesson-generation", processor, {
    connection: redisConn,
    concurrency: 2,
    stalledInterval: 30000,
    maxStalledCount: 3,
  });

  worker.on("completed", (job) => {
    console.log(`[queue] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[queue] Job ${job?.id} failed:`, err.message);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[queue] Job ${jobId} stalled — will retry`);
  });

  console.log("[queue] Lesson generation worker started");
  return worker;
}

// ── Graceful shutdown ──
export async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (redisConn) {
    await redisConn.quit();
  }
}

// ── Inline fallback ──
// If Redis is not available, run the job immediately.
export async function addJobInlineOrQueued(
  jobData: any,
  processor: (job: Job) => Promise<void>
) {
  if (lessonQueue) {
    const job = await lessonQueue.add("generate-lesson", jobData, {
      attempts: 3,
      backoff: { type: "exponential", delay: 30000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
    return { queued: true, jobId: job.id };
  }

  // No Redis — run inline (fire-and-forget, same as before)
  console.warn("[queue] No Redis — running generation inline (fire-and-forget)");
  const fakeJob = { id: "inline", data: jobData } as Job;
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  processor(fakeJob);
  return { queued: false, jobId: "inline" };
}
