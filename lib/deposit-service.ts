/**
 * Logika bisnis pencatatan setoran. Dipisah dari route agar bisa diuji langsung.
 * Semua perhitungan uang memakai Prisma.Decimal, TIDAK PERNAH angka JavaScript biasa.
 */
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { CreateDepositInput } from "./validation/deposit";

export class DepositError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DepositError";
  }
}

export interface CreatedDeposit {
  id: string;
  transactionCode: string;
  nasabahId: string;
  nasabahName: string;
  totalWeightKg: string;
  totalAmount: string;
  balanceAfter: string;
}

function generateTransactionCode(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `DEP-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createDeposit(
  petugasId: string,
  input: CreateDepositInput
): Promise<CreatedDeposit> {
  // Semua langkah di bawah berhasil bersama atau gagal bersama (atomik).
  return prisma.$transaction(async (tx) => {
    // 1. Nasabah harus ada dan berperan nasabah.
    const nasabah = await tx.user.findFirst({
      where: { id: input.nasabah_id, role: "nasabah" },
      select: { id: true, name: true },
    });
    if (!nasabah) throw new DepositError("Nasabah tidak ditemukan.", 404);

    // 2. Harga dibaca DI DALAM transaksi dari database. Harga dari browser tidak pernah dipercaya.
    const ids = input.items.map((i) => i.waste_category_id);
    const categories = await tx.wasteCategory.findMany({
      where: { id: { in: ids }, is_active: true },
    });
    if (categories.length !== ids.length) {
      throw new DepositError("Ada kategori sampah yang tidak ditemukan atau sudah nonaktif.", 422);
    }
    const byId = new Map(categories.map((c) => [c.id, c]));

    // 3. Hitung subtotal per baris dan total (Decimal).
    let totalWeight = new Prisma.Decimal(0);
    let totalAmount = new Prisma.Decimal(0);
    const itemsData = input.items.map((item) => {
      const price = byId.get(item.waste_category_id)!.current_price_per_kg;
      const weight = new Prisma.Decimal(item.weight_kg);
      const subtotal = weight.mul(price).toDecimalPlaces(2);
      totalWeight = totalWeight.add(weight);
      totalAmount = totalAmount.add(subtotal);
      return {
        waste_category_id: item.waste_category_id,
        weight_kg: weight,
        price_per_kg_snapshot: price, // KUNCI HARGA: salinan harga saat setoran terjadi
        subtotal,
      };
    });

    if (totalAmount.lte(0)) {
      throw new DepositError("Total nilai setoran harus lebih dari Rp 0.", 422);
    }

    // 4. Simpan setoran beserta rinciannya.
    const deposit = await tx.deposit.create({
      data: {
        transaction_code: generateTransactionCode(),
        nasabah_id: nasabah.id,
        petugas_id: petugasId,
        total_weight_kg: totalWeight,
        total_amount: totalAmount,
        status: "COMPLETED",
        items: { create: itemsData },
      },
    });

    // 5. Tambah saldo secara atomik di database (balance = balance + total), bukan baca-lalu-tulis.
    const updated = await tx.user.update({
      where: { id: nasabah.id },
      data: { balance: { increment: totalAmount } },
      select: { balance: true },
    });
    const balanceAfter = updated.balance;
    const balanceBefore = balanceAfter.sub(totalAmount);

    // 6. Catat jejak audit mutasi saldo.
    await tx.balanceMutation.create({
      data: {
        user_id: nasabah.id,
        reference_type: "DEPOSIT",
        reference_id: deposit.id,
        mutation_type: "CREDIT",
        amount: totalAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
      },
    });

    return {
      id: deposit.id,
      transactionCode: deposit.transaction_code,
      nasabahId: nasabah.id,
      nasabahName: nasabah.name,
      totalWeightKg: totalWeight.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
    };
  });
}