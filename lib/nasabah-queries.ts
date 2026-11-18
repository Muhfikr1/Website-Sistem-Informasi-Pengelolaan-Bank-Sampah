/**
 * Query data untuk dashboard nasabah. Semua query dibatasi `nasabah_id` / `user_id` milik sesi,
 * jadi nasabah hanya bisa melihat datanya sendiri. Hasil dibuat "polos" (string/angka)
 * agar aman dikirim ke komponen.
 */
import { prisma } from "./prisma";
import type { DateRange } from "./validation/history";

export const DEPOSIT_PAGE_SIZE = 5;
export const MUTATION_PAGE_SIZE = 10;

export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

function clampPage(page: number, totalItems: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return { page: Math.min(Math.max(1, page), totalPages), totalPages };
}

function dateWhere(field: string, range: DateRange) {
  return range.gte || range.lte ? { [field]: { ...(range.gte && { gte: range.gte }), ...(range.lte && { lte: range.lte }) } } : {};
}

export async function getDashboardSummary(userId: string) {
  const [user, deposits, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { balance: true } }),
    prisma.deposit.aggregate({ where: { nasabah_id: userId }, _sum: { total_weight_kg: true }, _count: true }),
    prisma.withdrawal.aggregate({ where: { nasabah_id: userId, status: "PENDING" }, _sum: { amount: true } }),
  ]);
  const balance = Number(user?.balance ?? 0);
  const pendingTotal = Number(pending._sum.amount ?? 0);
  return {
    balance,
    pendingWithdrawals: pendingTotal,
    effectiveBalance: Math.max(0, balance - pendingTotal),
    totalWeightKg: Number(deposits._sum.total_weight_kg ?? 0),
    depositCount: deposits._count,
  };
}

export interface DepositRow {
  id: string;
  transactionCode: string;
  date: string;
  totalWeightKg: number;
  totalAmount: number;
  items: { name: string; weightKg: number; priceSnapshot: number; subtotal: number }[];
}

export async function getDepositHistory(
  userId: string,
  page: number,
  range: DateRange
): Promise<Paginated<DepositRow>> {
  const where = { nasabah_id: userId, ...dateWhere("deposit_date", range) };
  const totalItems = await prisma.deposit.count({ where });
  const { page: safePage, totalPages } = clampPage(page, totalItems, DEPOSIT_PAGE_SIZE);

  const rows = await prisma.deposit.findMany({
    where,
    orderBy: { deposit_date: "desc" },
    skip: (safePage - 1) * DEPOSIT_PAGE_SIZE,
    take: DEPOSIT_PAGE_SIZE,
    include: { items: { include: { waste_category: { select: { name: true } } } } },
  });

  return {
    page: safePage,
    totalPages,
    totalItems,
    items: rows.map((d) => ({
      id: d.id,
      transactionCode: d.transaction_code,
      date: d.deposit_date.toISOString(),
      totalWeightKg: Number(d.total_weight_kg),
      totalAmount: Number(d.total_amount),
      items: d.items.map((i) => ({
        name: i.waste_category.name,
        weightKg: Number(i.weight_kg),
        // Harga yang DIKUNCI saat setoran terjadi, bukan harga kategori hari ini.
        priceSnapshot: Number(i.price_per_kg_snapshot),
        subtotal: Number(i.subtotal),
      })),
    })),
  };
}

export interface MutationRow {
  id: string;
  date: string;
  type: "CREDIT" | "DEBIT";
  referenceType: string;
  amount: number;
  balanceAfter: number;
}

export async function getMutationHistory(
  userId: string,
  page: number,
  range: DateRange
): Promise<Paginated<MutationRow>> {
  const where = { user_id: userId, ...dateWhere("created_at", range) };
  const totalItems = await prisma.balanceMutation.count({ where });
  const { page: safePage, totalPages } = clampPage(page, totalItems, MUTATION_PAGE_SIZE);

  const rows = await prisma.balanceMutation.findMany({
    where,
    orderBy: { created_at: "desc" },
    skip: (safePage - 1) * MUTATION_PAGE_SIZE,
    take: MUTATION_PAGE_SIZE,
  });

  return {
    page: safePage,
    totalPages,
    totalItems,
    items: rows.map((m) => ({
      id: m.id,
      date: m.created_at.toISOString(),
      type: m.mutation_type as "CREDIT" | "DEBIT",
      referenceType: m.reference_type,
      amount: Number(m.amount),
      balanceAfter: Number(m.balance_after),
    })),
  };
}

export async function getWithdrawalHistory(userId: string, limit = 20) {
  const rows = await prisma.withdrawal.findMany({
    where: { nasabah_id: userId },
    orderBy: { requested_at: "desc" },
    take: limit,
  });
  return rows.map((w) => ({
    id: w.id,
    code: w.withdrawal_code,
    amount: Number(w.amount),
    status: w.status as "PENDING" | "APPROVED" | "REJECTED",
    requestedAt: w.requested_at.toISOString(),
    rejectionReason: w.rejection_reason,
  }));
}