import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { apiLogger, startTimer } from "@/lib/logger";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/ratelimit";
import { createWithdrawalSchema } from "@/lib/validation/withdrawal-request";
import { createWithdrawalRequest, WithdrawalError } from "@/lib/withdrawal-service";

export async function POST(request: NextRequest) {
  const stop = startTimer();
  const ip = getClientIp(request);
  const log = apiLogger.child({ operation: "create_withdrawal", ip });

  // 1. Rate limiting
  const rate = checkRateLimit(`withdrawal-create:${ip}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rate.success) {
    log.warn({ duration_ms: stop() }, "Rate limit terlampaui pada pengajuan penarikan");
    return createRateLimitResponse(rate.reset);
  }

  // 2. Autentikasi dan otorisasi (middleware tidak melindungi /api/*)
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Anda harus login terlebih dahulu." }, { status: 401 });
  }
  if (session.role !== "nasabah") {
    log.warn({ userId: session.id, role: session.role }, "Pengajuan penarikan ditolak: bukan nasabah");
    return NextResponse.json({ error: "Hanya nasabah yang boleh mengajukan penarikan saldo." }, { status: 403 });
  }

  // 3. Validasi Lapis 2 (Zod)
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON yang valid." }, { status: 400 });
  }
  const parsed = createWithdrawalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid.", field: "amount" },
      { status: 400 }
    );
  }

  // 4. Cek saldo efektif + simpan (dalam satu transaksi)
  try {
    const withdrawal = await createWithdrawalRequest(session.id, parsed.data.amount);
    log.info(
      { userId: session.id, withdrawalId: withdrawal.id, amount: withdrawal.amount, duration_ms: stop() },
      "Pengajuan penarikan tersimpan (PENDING)"
    );
    return NextResponse.json({ withdrawal }, { status: 201 });
  } catch (err) {
    if (err instanceof WithdrawalError) {
      log.warn({ userId: session.id, status: err.status, reason: err.message, duration_ms: stop() }, "Pengajuan penarikan ditolak");
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    log.error({ userId: session.id, err, duration_ms: stop() }, "Pengajuan penarikan gagal");
    return NextResponse.json({ error: "Terjadi kesalahan server saat menyimpan pengajuan." }, { status: 500 });
  }
}