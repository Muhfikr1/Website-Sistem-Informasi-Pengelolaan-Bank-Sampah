import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp, createRateLimitResponse } from "@/lib/ratelimit";
import { recordBalanceMutation, InsufficientBalanceError } from "@/lib/services/balance";
import { enqueuePushNotification } from "@/lib/queue";
import { processWithdrawalSchema } from "@/lib/validations/withdrawal";
import { formatRupiah } from "@/lib/ui-format";

interface LockedWithdrawalRow {
  id: string;
  nasabah_id: string;
  amount: string | number;
  status: string;
  withdrawal_code: string;
}

/**
 * POST /api/admin/withdrawals/[id]/process
 * Memproses persetujuan (APPROVE) atau penolakan (REJECT) penarikan saldo secara atomik.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = performance.now();
  const clientIp = getClientIp(request);

  // 1. Rate Limiting (Maksimal 20 proses penarikan per menit per IP)
  const rateLimitResult = checkRateLimit(`process-withdrawal:${clientIp}`, {
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!rateLimitResult.success) {
    logger.warn(
      { context: "ADMIN_WITHDRAWALS", ip: clientIp },
      "Rate limit exceeded pada endpoint proses penarikan saldo"
    );
    return createRateLimitResponse(rateLimitResult.reset);
  }

  try {
    // 2. Otorisasi Sesi Khusus Admin
    const session = await getSession(request);
    if (!session || session.role !== "admin") {
      logger.warn(
        { context: "ADMIN_WITHDRAWALS", ip: clientIp, sessionUserId: session?.id, role: session?.role },
        "Akses ditolak pada proses penarikan: bukan role admin"
      );
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Administrator yang berhak memproses penarikan saldo." },
        { status: 403 }
      );
    }

    const { id: withdrawalId } = await params;
    if (!withdrawalId) {
      return NextResponse.json({ error: "ID pengajuan penarikan wajib disertakan." }, { status: 400 });
    }

    // 3. Validasi Request Body dengan Zod (Validasi Lapis 2)
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Format request body tidak valid." }, { status: 400 });
    }

    const parseResult = processWithdrawalSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || "Data input tidak valid.";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { action, rejectionReason } = parseResult.data;

    // 4. Jalankan Prisma Database Transaction secara Atomik
    const transactionResult = await prisma.$transaction(async (tx) => {
      // a. Kunci baris withdrawal dengan PostgreSQL Row-Level Locking (SELECT FOR UPDATE)
      const lockedRows = await tx.$queryRaw<LockedWithdrawalRow[]>`
        SELECT id, nasabah_id, amount, status, withdrawal_code 
        FROM withdrawals 
        WHERE id = ${withdrawalId} 
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new Error("NOT_FOUND:Pengajuan penarikan tidak ditemukan.");
      }

      const lockedWithdrawal = lockedRows[0];

      // b. Cek status: hanya yang berstatus PENDING yang boleh diproses
      if (lockedWithdrawal.status !== "PENDING") {
        throw new Error(
          "ALREADY_PROCESSED:Pengajuan penarikan ini sudah diproses sebelumnya."
        );
      }

      const amountNum = Number(lockedWithdrawal.amount);
      const now = new Date();

      if (action === "APPROVE") {
        // c. Panggil Service Mutasi Saldo Terpusat (DEBIT)
        // Service ini akan mengunci baris user dengan FOR UPDATE dan memvalidasi kecukupan saldo
        await recordBalanceMutation(tx, {
          userId: lockedWithdrawal.nasabah_id,
          amount: amountNum,
          mutationType: "DEBIT",
          referenceType: "WITHDRAWAL",
          referenceId: lockedWithdrawal.id,
        });

        // Update status withdrawal menjadi APPROVED
        const updated = await tx.withdrawal.update({
          where: { id: lockedWithdrawal.id },
          data: {
            status: "APPROVED",
            approved_by: session.id,
            processed_at: now,
          },
          include: {
            nasabah: {
              select: { id: true, name: true, email: true, balance: true },
            },
          },
        });

        return {
          action,
          withdrawal: updated,
          nasabahId: lockedWithdrawal.nasabah_id,
          withdrawalCode: lockedWithdrawal.withdrawal_code,
          amount: amountNum,
        };
      } else {
        // d. Jika REJECT: update status menjadi REJECTED, catat alasan dan approver, saldo nasabah utuh
        const updated = await tx.withdrawal.update({
          where: { id: lockedWithdrawal.id },
          data: {
            status: "REJECTED",
            approved_by: session.id,
            rejection_reason: rejectionReason?.trim() || null,
            processed_at: now,
          },
          include: {
            nasabah: {
              select: { id: true, name: true, email: true, balance: true },
            },
          },
        });

        return {
          action,
          withdrawal: updated,
          nasabahId: lockedWithdrawal.nasabah_id,
          withdrawalCode: lockedWithdrawal.withdrawal_code,
          amount: amountNum,
          rejectionReason: rejectionReason?.trim(),
        };
      }
    });

    // 5. SETELAH Transaksi Database Sukses Di-Commit:
    // Masukkan Job Web Push Notification ke antrean BullMQ (blok try-catch terpisah)
    try {
      const uniqueJobId = `withdrawal-${action.toLowerCase()}-${transactionResult.withdrawal.id}`;
      const amountFormatted = formatRupiah(transactionResult.amount);

      if (action === "APPROVE") {
        await enqueuePushNotification(
          {
            type: "WITHDRAWAL_APPROVED",
            userId: transactionResult.nasabahId,
            title: "Penarikan Saldo Disetujui! 🎉",
            body: `Penarikan Disetujui! Dana sebesar ${amountFormatted} (Kode: ${transactionResult.withdrawalCode}) telah disetujui oleh Admin.`,
            url: "/nasabah/withdrawals",
          },
          uniqueJobId
        );
      } else {
        await enqueuePushNotification(
          {
            type: "WITHDRAWAL_REJECTED",
            userId: transactionResult.nasabahId,
            title: "Penarikan Saldo Ditolak",
            body: `Penarikan Ditolak: Pengajuan ${amountFormatted} ditolak dengan alasan: ${transactionResult.rejectionReason}`,
            url: "/nasabah/withdrawals",
          },
          uniqueJobId
        );
      }
    } catch (queueErr) {
      // Kegagalan antrean tidak membatalkan transaksi DB
      logger.error(
        { context: "ADMIN_WITHDRAWALS", err: queueErr, withdrawalId },
        "Gagal enqueue notifikasi push (transaksi DB penarikan tetap sah)"
      );
    }

    const durationMs = Math.round(performance.now() - startedAt);
    logger.info(
      {
        context: "ADMIN_WITHDRAWALS",
        operation: "processWithdrawal",
        action,
        withdrawalId,
        nasabahId: transactionResult.nasabahId,
        adminId: session.id,
        duration_ms: durationMs,
      },
      `Pengajuan penarikan ${transactionResult.withdrawalCode} berhasil di-${action}`
    );

    return NextResponse.json({
      message:
        action === "APPROVE"
          ? "Pengajuan penarikan saldo berhasil disetujui."
          : "Pengajuan penarikan saldo berhasil ditolak.",
      withdrawal: {
        id: transactionResult.withdrawal.id,
        withdrawalCode: transactionResult.withdrawal.withdrawal_code,
        status: transactionResult.withdrawal.status,
        amount: Number(transactionResult.withdrawal.amount),
        processedAt: transactionResult.withdrawal.processed_at,
        nasabah: {
          id: transactionResult.withdrawal.nasabah.id,
          name: transactionResult.withdrawal.nasabah.name,
          balance: Number(transactionResult.withdrawal.nasabah.balance),
        },
      },
    });
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - startedAt);

    if (error instanceof InsufficientBalanceError) {
      logger.warn(
        { context: "ADMIN_WITHDRAWALS", duration_ms: durationMs, err: error.message },
        "Gagal approve penarikan: Saldo nasabah tidak mencukupi"
      );
      return NextResponse.json(
        {
          error: "Saldo nasabah saat ini tidak mencukupi untuk menyelesaikan penarikan ini.",
          balanceBefore: error.balanceBefore,
          attemptedAmount: error.attemptedAmount,
        },
        { status: 422 }
      );
    }

    const errMessage = (error as Error)?.message || "";

    if (errMessage.startsWith("NOT_FOUND:")) {
      return NextResponse.json({ error: errMessage.replace("NOT_FOUND:", "") }, { status: 404 });
    }

    if (errMessage.startsWith("ALREADY_PROCESSED:")) {
      return NextResponse.json({ error: errMessage.replace("ALREADY_PROCESSED:", "") }, { status: 400 });
    }

    logger.error(
      { context: "ADMIN_WITHDRAWALS", duration_ms: durationMs, err: error },
      "Error internal saat memproses penarikan saldo"
    );

    return NextResponse.json(
      { error: "Terjadi kesalahan internal server saat memproses penarikan saldo." },
      { status: 500 }
    );
  }
}
