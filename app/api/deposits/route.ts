import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { apiLogger, startTimer } from "@/lib/logger";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/ratelimit";
import { createDepositSchema } from "@/lib/validation/deposit";
import { createDeposit, DepositError } from "@/lib/deposit-service";
import { enqueuePushNotification } from "@/lib/queue";
import { formatRupiah } from "@/lib/ui-format";

export async function POST(request: NextRequest) {
  const stop = startTimer();
  const ip = getClientIp(request);
  const log = apiLogger.child({ operation: "create_deposit", ip });

  // 1. Rate limiting
  const rate = checkRateLimit(`deposit-create:${ip}`, { limit: 30, windowMs: 60 * 1000 });
  if (!rate.success) {
    log.warn({ duration_ms: stop() }, "Rate limit terlampaui pada pencatatan setoran");
    return createRateLimitResponse(rate.reset);
  }

  // 2. Autentikasi dan otorisasi (middleware tidak melindungi /api/*)
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Anda harus login terlebih dahulu." }, { status: 401 });
  }
  if (session.role !== "petugas") {
    log.warn({ userId: session.id, role: session.role }, "Pencatatan setoran ditolak: bukan petugas");
    return NextResponse.json({ error: "Hanya petugas yang boleh mencatat setoran." }, { status: 403 });
  }

  // 3. Validasi Lapis 2 (Zod)
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON yang valid." }, { status: 400 });
  }
  const parsed = createDepositSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Data tidak valid.", field: issue?.path.join(".") },
      { status: 400 }
    );
  }

  // 4. Transaksi database
  let deposit;
  try {
    deposit = await createDeposit(session.id, parsed.data);
  } catch (err) {
    if (err instanceof DepositError) {
      log.warn({ userId: session.id, status: err.status, reason: err.message, duration_ms: stop() }, "Setoran ditolak");
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    log.error({ userId: session.id, err, duration_ms: stop() }, "Transaksi setoran gagal");
    return NextResponse.json({ error: "Terjadi kesalahan server saat menyimpan setoran." }, { status: 500 });
  }

  // 5. Notifikasi di luar transaksi. Fungsi ini tidak pernah melempar error,
  //    jadi Redis mati TIDAK membatalkan setoran yang sudah tersimpan.
  const notificationQueued = await enqueuePushNotification(
    {
      type: "DEPOSIT_VALIDATED",
      userId: deposit.nasabahId,
      title: "Setoran Berhasil Dicatat",
      body: `Setoran ${deposit.totalWeightKg} kg senilai ${formatRupiah(Number(deposit.totalAmount))} masuk ke saldo Anda.`,
      url: "/nasabah/dashboard",
    },
    `deposit-notif-${deposit.id}`
  );

  log.info(
    { userId: session.id, depositId: deposit.id, nasabahId: deposit.nasabahId, notificationQueued, duration_ms: stop() },
    "Setoran berhasil dicatat"
  );

  return NextResponse.json({ deposit, notificationQueued }, { status: 201 });
}