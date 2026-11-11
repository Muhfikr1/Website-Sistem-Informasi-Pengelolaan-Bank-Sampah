/**
 * Proses Background Worker untuk Web Push (BullMQ + Redis).
 * Berjalan TERPISAH dari server Next.js.
 *
 * Jalankan di terminal sendiri:  npm run worker
 */
import { Worker, UnrecoverableError, type Job } from "bullmq";
import webpush from "web-push";
import { prisma } from "../lib/prisma";
import { createRedisConnection } from "../lib/redis";
import { workerLogger, startTimer } from "../lib/logger";
import { PUSH_QUEUE_NAME, pushJobSchema } from "../lib/queue";
import { processPushJob } from "./push-processor";

// 1. Konfigurasi VAPID. Kunci privat hanya ada di proses ini (server), tidak pernah ke browser.
const vapidSubject = process.env.VAPID_SUBJECT;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
  workerLogger.fatal(
    { operation: "worker_boot" },
    "VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, dan VAPID_PRIVATE_KEY wajib diisi di .env"
  );
  process.exit(1);
}
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

// 2. Koneksi khusus Worker (maxRetriesPerRequest: null adalah bawaan createRedisConnection).
const connection = createRedisConnection();

// 3. Worker: membaca antrean 'web-push-queue' dan memproses tiap job.
const worker = new Worker(
  PUSH_QUEUE_NAME,
  async (job: Job) => {
    const stop = startTimer();

    // Job yang bentuknya salah tidak akan membaik jika diulang, jadi langsung gagal permanen.
    const parsed = pushJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Data job tidak valid: ${parsed.error.issues[0]?.message}`);
    }
    const data = parsed.data;

    const log = workerLogger.child({
      jobId: job.id,
      type: data.type,
      userId: data.userId,
      attempt: job.attemptsMade + 1,
    });

    const result = await processPushJob(
      data,
      (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 60 * 60 }),
      log
    );

    log.info({ operation: "process_push", duration_ms: stop(), ...result }, "Job selesai diproses");
    return result;
  },
  { connection, concurrency: 5 }
);

// 4. Listener lifecycle: kegagalan dicatat terang-terangan, tidak pernah diam-diam.
worker.on("completed", (job, result) => {
  workerLogger.info(
    { operation: "job_completed", jobId: job.id, type: job.name, attemptsMade: job.attemptsMade, result },
    "Job completed"
  );
});

worker.on("failed", (job, err) => {
  const willRetry = job ? job.attemptsMade < (job.opts.attempts ?? 1) && !(err instanceof UnrecoverableError) : false;
  workerLogger.error(
    {
      operation: "job_failed",
      jobId: job?.id,
      type: job?.name,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      willRetry,
      err,
    },
    willRetry ? "Job failed, akan dicoba ulang" : "Job failed permanen"
  );
});

worker.on("error", (err) => {
  workerLogger.error({ operation: "worker_error", err }, "Worker mengalami error");
});

worker.on("ready", () => {
  workerLogger.info({ operation: "worker_boot", queue: PUSH_QUEUE_NAME }, "Worker siap menerima job");
});

// 5. Berhenti dengan rapi saat Ctrl+C: tunggu job yang sedang berjalan selesai.
async function shutdown(signal: string) {
  workerLogger.info({ operation: "worker_shutdown", signal }, "Worker berhenti");
  await worker.close();
  await prisma.$disconnect();
  connection.disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));