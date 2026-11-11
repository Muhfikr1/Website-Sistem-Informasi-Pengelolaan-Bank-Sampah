/**
 * Antrean persisten untuk Web Push (BullMQ + Redis).
 *
 * Dipakai oleh siapa pun yang menyelesaikan kejadian bisnis dan perlu memberi tahu nasabah:
 *   - Setoran dicatat petugas      (DEPOSIT_VALIDATED)    -> Orang 3
 *   - Penarikan disetujui admin    (WITHDRAWAL_APPROVED)  -> Orang 1
 *   - Penarikan ditolak admin      (WITHDRAWAL_REJECTED)  -> Orang 1
 *
 * Cara pakai (SETELAH transaksi database berhasil commit):
 *   await enqueuePushNotification(
 *     { type: "DEPOSIT_VALIDATED", userId, title, body, url: "/nasabah/dashboard" },
 *     `deposit-notif-${deposit.id}`
 *   );
 *
 * Fungsi itu tidak pernah melempar error: jika Redis mati, transaksi bisnis tetap sah.
 *
 * Catatan: file ini memakai import relatif (bukan "@/") karena juga dimuat oleh
 * proses worker (tsx) di luar Next.js.
 */
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { z } from "zod";
import { createRedisConnection } from "./redis";
import { apiLogger, startTimer } from "./logger";

export const PUSH_QUEUE_NAME = "web-push-queue";

/** Bentuk data satu job. Dicek lagi oleh worker, jadi job rusak tidak lolos. */
export const pushJobSchema = z.object({
  type: z.enum(["DEPOSIT_VALIDATED", "WITHDRAWAL_APPROVED", "WITHDRAWAL_REJECTED"]),
  userId: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(300),
  /** Halaman yang dibuka saat notifikasi diklik, misalnya "/nasabah/dashboard". */
  url: z.string().startsWith("/"),
});

export type PushJobData = z.infer<typeof pushJobSchema>;

const ENQUEUE_TIMEOUT_MS = 3000;

// Satu instance per proses. globalThis mencegah koneksi menumpuk saat hot reload di `next dev`.
const globalForQueue = globalThis as unknown as {
  pushQueue?: Queue<PushJobData>;
  pushQueueConnection?: Redis;
};

export function getPushQueue(): Queue<PushJobData> {
  if (!globalForQueue.pushQueue) {
    // Sisi pengirim: gagal cepat saat Redis mati, jangan menggantung selamanya.
    // (maxRetriesPerRequest: null hanya wajib untuk Worker.)
    const connection = createRedisConnection({ maxRetriesPerRequest: 1 });
    globalForQueue.pushQueueConnection = connection;
    const queue = new Queue<PushJobData>(PUSH_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3, // coba maksimal 3 kali
        backoff: { type: "exponential", delay: 2000 }, // jeda 2 detik, lalu 4 detik
        removeOnComplete: { age: 60 * 60, count: 1000 },
        removeOnFail: { age: 24 * 60 * 60, count: 1000 },
      },
    });
    queue.on("error", (err) => {
      apiLogger.error({ operation: "push_queue", err }, "Antrean web-push bermasalah");
    });
    globalForQueue.pushQueue = queue;
  }
  return globalForQueue.pushQueue;
}

/** Menutup antrean. Dipanggil oleh script CLI agar proses bisa berhenti sendiri. */
export async function closePushQueue(): Promise<void> {
  if (globalForQueue.pushQueue) {
    await globalForQueue.pushQueue.close();
    globalForQueue.pushQueue = undefined;
  }
  // Koneksi yang kita buat sendiri harus kita tutup sendiri.
  if (globalForQueue.pushQueueConnection) {
    globalForQueue.pushQueueConnection.disconnect();
    globalForQueue.pushQueueConnection = undefined;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis tidak merespons dalam ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Memasukkan satu job notifikasi ke antrean.
 *
 * @param jobId  ID unik pencegah pengiriman ganda, misalnya `deposit-notif-<depositId>`.
 *               Job dengan jobId yang sama tidak akan dimasukkan dua kali.
 *               Jangan memakai tanda titik dua (:) di jobId (ditolak BullMQ).
 * @returns true jika job masuk antrean, false jika gagal (error sudah dicatat di log).
 */
export async function enqueuePushNotification(
  data: PushJobData,
  jobId: string
): Promise<boolean> {
  const stop = startTimer();
  try {
    const job = pushJobSchema.parse(data);
    await withTimeout(getPushQueue().add(job.type, job, { jobId }), ENQUEUE_TIMEOUT_MS);
    apiLogger.info(
      { operation: "enqueue_push", jobId, type: job.type, userId: job.userId, duration_ms: stop() },
      "Job notifikasi masuk antrean"
    );
    return true;
  } catch (err) {
    apiLogger.error(
      { operation: "enqueue_push", jobId, type: data.type, userId: data.userId, err, duration_ms: stop() },
      "Gagal memasukkan job notifikasi ke antrean (transaksi bisnis tetap sah)"
    );
    return false;
  }
}