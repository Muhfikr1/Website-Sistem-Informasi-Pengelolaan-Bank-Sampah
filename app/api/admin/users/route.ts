import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Skema validasi query parameters untuk GET /api/admin/users
export const adminUsersQuerySchema = z.object({
  role: z.enum(["all", "nasabah", "petugas", "admin"]).default("all"),
  search: z.string().trim().optional().default(""),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// Skema validasi request body untuk POST /api/admin/users (Tambah Petugas Baru)
export const createPetugasSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format alamat email tidak valid"),
  password: z
    .string()
    .min(6, "Kata sandi minimal 6 karakter")
    .max(100, "Kata sandi maksimal 100 karakter"),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon maksimal 30 karakter")
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .max(300, "Alamat maksimal 300 karakter")
    .optional()
    .nullable(),
});

/**
 * GET /api/admin/users
 * Mengambil daftar pengguna (nasabah/petugas/admin) beserta ringkasan dokumen dan setoran
 */
export async function GET(request: NextRequest) {
  const startedAt = performance.now();

  try {
    // 1. Otorisasi Sesi Khusus Admin
    const session = await getSession(request);
    if (!session || session.role !== "admin") {
      logger.warn(
        { context: "ADMIN_USERS", sessionUserId: session?.id, role: session?.role },
        "Akses ditolak pada GET /api/admin/users: bukan role admin"
      );
      return NextResponse.json(
        { error: "Akses ditolak. Rute ini hanya dapat diakses oleh Administrator." },
        { status: 403 }
      );
    }

    // 2. Validasi Query Parameter dengan Zod
    const url = new URL(request.url);
    const parseResult = adminUsersQuerySchema.safeParse({
      role: url.searchParams.get("role") || undefined,
      search: url.searchParams.get("search") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });

    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || "Parameter query tidak valid";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { role, search, page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    // 3. Susun Kondisi Filter Prisma
    const where: Prisma.UserWhereInput = {};

    if (role !== "all") {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // 4. Eksekusi Query Paralel: Users List, Total Count, dan Summary Metrics
    const [users, totalFiltered, totalNasabah, totalPetugas, balanceAggregate, totalDocs] =
      await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            role: true,
            balance: true,
            created_at: true,
            documents: {
              select: {
                id: true,
                document_type: true,
                original_name: true,
                mime_type: true,
                size_bytes: true,
                created_at: true,
              },
              orderBy: { created_at: "desc" },
            },
            _count: {
              select: {
                depositsAsNasabah: true,
              },
            },
            depositsAsNasabah: {
              select: {
                total_weight_kg: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { role: "nasabah" } }),
        prisma.user.count({ where: { role: "petugas" } }),
        prisma.user.aggregate({
          where: { role: "nasabah" },
          _sum: { balance: true },
        }),
        prisma.userDocument.count(),
      ]);

    // 5. Transformasi Data User & Hitung Total Berat Sampah Per User (Bebas N+1)
    const formattedUsers = users.map((u) => {
      let totalWeightKg = 0;
      if (u.role === "nasabah" && u.depositsAsNasabah) {
        totalWeightKg = u.depositsAsNasabah.reduce(
          (sum, dep) => sum + Number(dep.total_weight_kg || 0),
          0
        );
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        role: u.role,
        balance: Number(u.balance || 0),
        createdAt: u.created_at,
        documents: u.documents.map((d) => ({
          id: d.id,
          documentType: d.document_type,
          originalName: d.original_name,
          mimeType: d.mime_type,
          sizeBytes: d.size_bytes,
          createdAt: d.created_at,
        })),
        depositsCount: u._count.depositsAsNasabah,
        totalWeightKg: Math.round(totalWeightKg * 100) / 100,
      };
    });

    const durationMs = Math.round(performance.now() - startedAt);
    logger.info(
      {
        context: "ADMIN_USERS",
        operation: "getAdminUsers",
        role,
        search,
        page,
        limit,
        resultCount: formattedUsers.length,
        totalFiltered,
        duration_ms: durationMs,
      },
      "Berhasil memuat daftar user untuk panel admin"
    );

    const totalPages = Math.ceil(totalFiltered / limit) || 1;

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        total: totalFiltered,
        page,
        limit,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      summary: {
        totalNasabah,
        totalPetugas,
        totalNasabahBalance: Number(balanceAggregate._sum.balance || 0),
        totalDocuments: totalDocs,
      },
    });
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.error(
      { context: "ADMIN_USERS", duration_ms: durationMs, err: error },
      "Gagal memuat daftar pengguna admin"
    );
    return NextResponse.json(
      { error: "Terjadi kesalahan internal server saat memuat data pengguna" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Endpoint khusus Admin untuk membuat akun Petugas baru
 */
export async function POST(request: NextRequest) {
  const startedAt = performance.now();

  try {
    // 1. Otorisasi Sesi Khusus Admin
    const session = await getSession(request);
    if (!session || session.role !== "admin") {
      logger.warn(
        { context: "ADMIN_USERS", sessionUserId: session?.id, role: session?.role },
        "Akses ditolak pada POST /api/admin/users: bukan role admin"
      );
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Administrator yang dapat mendaftarkan akun Petugas." },
        { status: 403 }
      );
    }

    // 2. Validasi Lapis 2: Skema Zod
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Format request body tidak valid" }, { status: 400 });
    }

    const parseResult = createPetugasSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || "Data input tidak valid";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { name, email, password, phone, address } = parseResult.data;

    // 3. Cek Keunikan Email
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Email ${email} sudah terdaftar di sistem. Gunakan alamat email lain.` },
        { status: 409 }
      );
    }

    // 4. Hash Kata Sandi Petugas
    const password_hash = await bcrypt.hash(password, 10);

    // 5. Simpan Akun Petugas ke Database (Validasi Lapis 3: CHECK Constraint balance >= 0)
    const newPetugas = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        phone: phone || null,
        address: address || null,
        role: "petugas",
        balance: 0.0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        balance: true,
        created_at: true,
      },
    });

    const durationMs = Math.round(performance.now() - startedAt);
    logger.info(
      {
        context: "ADMIN_USERS",
        operation: "createPetugas",
        adminId: session.id,
        newPetugasId: newPetugas.id,
        newPetugasEmail: newPetugas.email,
        duration_ms: durationMs,
      },
      `Akun petugas baru '${newPetugas.name}' berhasil didaftarkan oleh admin`
    );

    return NextResponse.json(
      {
        message: "Akun petugas berhasil dibuat",
        user: {
          id: newPetugas.id,
          name: newPetugas.name,
          email: newPetugas.email,
          phone: newPetugas.phone,
          address: newPetugas.address,
          role: newPetugas.role,
          balance: Number(newPetugas.balance),
          createdAt: newPetugas.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.error(
      { context: "ADMIN_USERS", duration_ms: durationMs, err: error },
      "Gagal mendaftarkan akun petugas baru"
    );
    return NextResponse.json(
      { error: "Terjadi kesalahan internal server saat membuat akun petugas" },
      { status: 500 }
    );
  }
}
