import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { adminWithdrawalsQuerySchema } from "@/lib/validations/withdrawal";

/**
 * GET /api/admin/withdrawals
 * Mengambil daftar pengajuan penarikan saldo dengan pagination, filter status,
 * pencarian nasabah/kode penarikan, serta ringkasan statistik.
 */
export async function GET(request: NextRequest) {
  const startedAt = performance.now();

  try {
    // 1. Otorisasi Sesi Khusus Admin
    const session = await getSession(request);
    if (!session || session.role !== "admin") {
      logger.warn(
        { context: "ADMIN_WITHDRAWALS", sessionUserId: session?.id, role: session?.role },
        "Akses ditolak pada GET /api/admin/withdrawals: bukan role admin"
      );
      return NextResponse.json(
        { error: "Akses ditolak. Rute ini hanya dapat diakses oleh Administrator." },
        { status: 403 }
      );
    }

    // 2. Validasi Query Parameter dengan Zod
    const url = new URL(request.url);
    const parseResult = adminWithdrawalsQuerySchema.safeParse({
      status: url.searchParams.get("status") || undefined,
      search: url.searchParams.get("search") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });

    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || "Parameter query tidak valid";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { status, search, page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    // 3. Susun Kondisi Filter Prisma
    const where: Prisma.WithdrawalWhereInput = {};

    if (status !== "ALL") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { withdrawal_code: { contains: search, mode: "insensitive" } },
        { nasabah: { name: { contains: search, mode: "insensitive" } } },
        { nasabah: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // 4. Query Paralel: List Withdrawals, Count Filtered, dan Summary Stats
    const [withdrawals, totalFiltered, pendingCount, approvedStats, rejectedCount] =
      await Promise.all([
        prisma.withdrawal.findMany({
          where,
          skip,
          take: limit,
          orderBy: { requested_at: "desc" },
          select: {
            id: true,
            withdrawal_code: true,
            amount: true,
            status: true,
            rejection_reason: true,
            requested_at: true,
            processed_at: true,
            nasabah: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                balance: true,
              },
            },
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.withdrawal.count({ where }),
        prisma.withdrawal.count({ where: { status: "PENDING" } }),
        prisma.withdrawal.aggregate({
          where: { status: "APPROVED" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.withdrawal.count({ where: { status: "REJECTED" } }),
      ]);

    // 5. Format Data Response
    const formattedItems = withdrawals.map((w) => ({
      id: w.id,
      withdrawalCode: w.withdrawal_code,
      amount: Number(w.amount),
      status: w.status,
      rejectionReason: w.rejection_reason,
      requestedAt: w.requested_at,
      processedAt: w.processed_at,
      nasabah: {
        id: w.nasabah.id,
        name: w.nasabah.name,
        email: w.nasabah.email,
        phone: w.nasabah.phone,
        balance: Number(w.nasabah.balance),
      },
      approver: w.approver
        ? {
            id: w.approver.id,
            name: w.approver.name,
            email: w.approver.email,
          }
        : null,
    }));

    const durationMs = Math.round(performance.now() - startedAt);
    logger.info(
      {
        context: "ADMIN_WITHDRAWALS",
        operation: "getAdminWithdrawals",
        status,
        search,
        page,
        limit,
        resultCount: formattedItems.length,
        totalFiltered,
        duration_ms: durationMs,
      },
      "Berhasil memuat daftar penarikan saldo admin"
    );

    const totalPages = Math.ceil(totalFiltered / limit) || 1;

    return NextResponse.json({
      items: formattedItems,
      pagination: {
        total: totalFiltered,
        page,
        limit,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      summary: {
        totalPending: pendingCount,
        totalApproved: approvedStats._count._all || 0,
        totalApprovedAmount: Number(approvedStats._sum.amount || 0),
        totalRejected: rejectedCount,
      },
    });
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.error(
      { context: "ADMIN_WITHDRAWALS", duration_ms: durationMs, err: error },
      "Gagal memuat daftar penarikan saldo admin"
    );
    return NextResponse.json(
      { error: "Terjadi kesalahan internal server saat memuat data penarikan saldo." },
      { status: 500 }
    );
  }
}
