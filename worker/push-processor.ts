/**
 * Logika memproses SATU job Web Push, dipisah dari worker/index.ts supaya
 * mudah diuji (fungsi pengirim bisa diganti dengan tiruan).
 */
import type { Logger } from "pino";
import type { PushSubscription } from "web-push";
import { prisma } from "../lib/prisma";
import type { PushJobData } from "../lib/queue";

/** Fungsi yang benar-benar mengirim ke layanan push browser. */
export type SendFn = (subscription: PushSubscription, payload: string) => Promise<unknown>;

export interface PushResult {
  sent: number;
  gone: number;
  failed: number;
}

/**
 * Mengirim notifikasi ke semua langganan aktif milik data.userId.
 *
 *  - Langganan kedaluwarsa (HTTP 404/410)  -> dinonaktifkan (is_active = false), BUKAN dianggap gagal.
 *  - Semua pengiriman gagal karena error lain -> melempar error, sehingga BullMQ mencoba ulang (retry).
 *  - Sebagian berhasil, sebagian gagal   -> dianggap selesai (mencoba ulang akan mengirim ganda
 *                                           ke perangkat yang sudah menerima).
 */
export async function processPushJob(
  data: PushJobData,
  send: SendFn,
  log: Logger
): Promise<PushResult> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { user_id: data.userId, is_active: true },
  });

  const result: PushResult = { sent: 0, gone: 0, failed: 0 };

  if (subscriptions.length === 0) {
    log.warn({ operation: "push_send" }, "Nasabah tidak punya langganan notifikasi aktif, job dilewati");
    return result;
  }

  const payload = JSON.stringify({
    title: data.title,
    body: data.body,
    url: data.url,
    type: data.type,
  });

  for (const subscription of subscriptions) {
    try {
      await send(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key },
        },
        payload
      );
      result.sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;

      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { is_active: false },
        });
        result.gone += 1;
        log.warn(
          { operation: "push_send", subscriptionId: subscription.id, statusCode },
          "Langganan kedaluwarsa (Gone), dinonaktifkan"
        );
      } else {
        result.failed += 1;
        log.error(
          { operation: "push_send", subscriptionId: subscription.id, statusCode, err },
          "Gagal mengirim notifikasi ke satu langganan"
        );
      }
    }
  }

  if (result.sent === 0 && result.failed > 0) {
    throw new Error(`Semua pengiriman gagal (${result.failed} langganan)`);
  }

  return result;
}