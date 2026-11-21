/**
 * Query laporan rekapitulasi admin.
 *
 * BEBAS N+1: jumlah query SELALU tetap (5 buah) berapa pun banyaknya kategori atau nasabah,
 * karena semua penjumlahan dikerjakan database lewat aggregate/groupBy, lalu dijalankan
 * bersamaan dengan Promise.all. Nama kategori diambil sekali untuk semua kategori (bukan satu per baris).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultClient } from "./prisma";
import type { DateRange } from "./validation/history";

export interface CategoryReportRow {
  categoryId: string;
  code: string;
  name: string;
  isActive: boolean;
  /** Berapa baris item setoran yang memakai kategori ini. */
  itemCount: number;
  totalWeightKg: number;
  /** Jumlah subtotal yang dikunci saat setoran (bukan harga hari ini). */
  totalValue: number;
}

export interface WithdrawalStatusSummary {
  count: number;
  totalAmount: number;
}

export interface AdminReport {
  deposits: { count: number; totalWeightKg: number; totalAmount: number };
  categories: CategoryReportRow[];
  withdrawals: {
    approved: WithdrawalStatusSummary;
    pending: WithdrawalStatusSummary;
    rejected: WithdrawalStatusSummary;
  };
  /** Kondisi saat laporan dibuat; tidak terikat rentang tanggal. */
  balances: { nasabahCount: number; totalBalance: number };
  generatedAt: string;
}

const num = (value: { toString(): string } | null | undefined): number => Number(value ?? 0);

/** Filter tanggal untuk kolom `field`; kosong jika rentang tidak diisi. */
function between(range: DateRange): { gte?: Date; lte?: Date } | undefined {
  if (!range.gte && !range.lte) return undefined;
  return { ...(range.gte && { gte: range.gte }), ...(range.lte && { lte: range.lte }) };
}

export async function getAdminReport(
  range: DateRange = {},
  client: PrismaClient = defaultClient
): Promise<AdminReport> {
  const period = between(range);

  const depositWhere: Prisma.DepositWhereInput = period ? { deposit_date: period } : {};

  // Penarikan: yang sudah diproses dihitung menurut waktu diproses, yang menunggu menurut waktu diajukan.
  const withdrawalWhere: Prisma.WithdrawalWhereInput = period
    ? {
        OR: [
          { status: "PENDING", requested_at: period },
          { status: { in: ["APPROVED", "REJECTED"] }, processed_at: period },
        ],
      }
    : {};

  const [depositTotals, itemSums, categories, withdrawalSums, balanceTotals] = await Promise.all([
    // 1. Total setoran
    client.deposit.aggregate({
      where: depositWhere,
      _count: { _all: true },
      _sum: { total_weight_kg: true, total_amount: true },
    }),
    // 2. Total per kategori (dijumlahkan di database)
    client.depositItem.groupBy({
      by: ["waste_category_id"],
      where: period ? { deposit: depositWhere } : undefined,
      _count: { _all: true },
      _sum: { weight_kg: true, subtotal: true },
    }),
    // 3. Semua kategori sekaligus, supaya kategori tanpa setoran tetap tampil dengan nilai 0
    client.wasteCategory.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, is_active: true },
    }),
    // 4. Penarikan per status
    client.withdrawal.groupBy({
      by: ["status"],
      where: withdrawalWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    // 5. Sisa saldo seluruh nasabah
    client.user.aggregate({
      where: { role: "nasabah" },
      _count: { _all: true },
      _sum: { balance: true },
    }),
  ]);

  const sumsByCategory = new Map(itemSums.map((row) => [row.waste_category_id, row]));
  const categoryRows: CategoryReportRow[] = categories.map((category) => {
    const sums = sumsByCategory.get(category.id);
    return {
      categoryId: category.id,
      code: category.code,
      name: category.name,
      isActive: category.is_active,
      itemCount: sums?._count._all ?? 0,
      totalWeightKg: num(sums?._sum.weight_kg),
      totalValue: num(sums?._sum.subtotal),
    };
  });

  const statusSummary = (status: "APPROVED" | "PENDING" | "REJECTED"): WithdrawalStatusSummary => {
    const row = withdrawalSums.find((item) => item.status === status);
    return { count: row?._count._all ?? 0, totalAmount: num(row?._sum.amount) };
  };

  return {
    deposits: {
      count: depositTotals._count._all,
      totalWeightKg: num(depositTotals._sum.total_weight_kg),
      totalAmount: num(depositTotals._sum.total_amount),
    },
    categories: categoryRows,
    withdrawals: {
      approved: statusSummary("APPROVED"),
      pending: statusSummary("PENDING"),
      rejected: statusSummary("REJECTED"),
    },
    balances: {
      nasabahCount: balanceTotals._count._all,
      totalBalance: num(balanceTotals._sum.balance),
    },
    generatedAt: new Date().toISOString(),
  };
}
