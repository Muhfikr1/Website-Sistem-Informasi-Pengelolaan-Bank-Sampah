/**
 * Logika bisnis pengajuan penarikan saldo oleh nasabah.
 * Validasi Lapis 2: saldo efektif = saldo - total penarikan PENDING.
 */
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class WithdrawalError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "WithdrawalError";
  }
}

export interface CreatedWithdrawal {
  id: string;
  withdrawalCode: string;
  amount: string;
  effectiveBalanceAfter: string;
}

function generateWithdrawalCode(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `WD-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function rupiah(value: Prisma.Decimal): string {
  return `Rp ${value.toDecimalPlaces(0).toNumber().toLocaleString("id-ID")}`;
}

export async function createWithdrawalRequest(
  nasabahId: string,
  amountText: string
): Promise<CreatedWithdrawal> {
  const amount = new Prisma.Decimal(amountText);

  return prisma.$transaction(async (tx) => {
    // 1. Kunci baris nasabah (FOR UPDATE). Dua pengajuan bersamaan dari nasabah yang sama
    //    jadi antre satu per satu, sehingga keduanya tidak bisa lolos pengecekan saldo sekaligus.
    const locked = await tx.$queryRaw<{ balance: Prisma.Decimal }[]>`
      SELECT balance FROM users WHERE id = ${nasabahId} FOR UPDATE
    `;
    if (locked.length === 0) throw new WithdrawalError("Akun nasabah tidak ditemukan.", 404);
    const balance = new Prisma.Decimal(locked[0].balance);

    // 2. Hitung saldo efektif = saldo - penarikan yang masih menunggu persetujuan.
    const pending = await tx.withdrawal.aggregate({
      where: { nasabah_id: nasabahId, status: "PENDING" },
      _sum: { amount: true },
    });
    const pendingTotal = new Prisma.Decimal(pending._sum.amount ?? 0);
    const effective = balance.sub(pendingTotal);

    // 3. Tolak otomatis jika melebihi saldo efektif.
    if (amount.gt(effective)) {
      const available = effective.lt(0) ? new Prisma.Decimal(0) : effective;
      throw new WithdrawalError(
        `Nominal melebihi saldo yang dapat ditarik. Saldo efektif Anda ${rupiah(available)}` +
          (pendingTotal.gt(0) ? ` (sudah dikurangi pengajuan menunggu ${rupiah(pendingTotal)}).` : "."),
        422
      );
    }

    // 4. Simpan pengajuan berstatus PENDING. Saldo BELUM dipotong; itu dilakukan admin saat menyetujui.
    const withdrawal = await tx.withdrawal.create({
      data: {
        withdrawal_code: generateWithdrawalCode(),
        nasabah_id: nasabahId,
        amount,
        status: "PENDING",
      },
    });

    return {
      id: withdrawal.id,
      withdrawalCode: withdrawal.withdrawal_code,
      amount: amount.toFixed(2),
      effectiveBalanceAfter: effective.sub(amount).toFixed(2),
    };
  });
}