import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { checkRateLimit, getClientIp, createRateLimitResponse } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid.")
    .min(1, "Email wajib diisi."),
  password: z
    .string()
    .min(1, "Kata sandi wajib diisi."),
});

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  // 1. Rate Limiting (Maks 10 percobaan per 1 menit per IP)
  const rateLimitResult = checkRateLimit(`login:${clientIp}`, {
    limit: 10,
    windowMs: 60 * 1000,
  });

  if (!rateLimitResult.success) {
    logger.warn(
      { ip: clientIp, remaining: rateLimitResult.remaining },
      "Rate limit exceeded pada endpoint login"
    );
    return createRateLimitResponse(rateLimitResult.reset);
  }

  try {
    const body = await request.json();

    // 2. Validasi Skema Zod (Validasi Lapis 2)
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError =
        validationResult.error.issues[0]?.message || "Format input login tidak valid.";
      logger.warn({ ip: clientIp, errors: validationResult.error.issues }, "Validasi login gagal");
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, password } = validationResult.data;

    // 3. Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      logger.warn({ ip: clientIp, email }, "Percobaan login gagal: user tidak ditemukan");
      return NextResponse.json(
        { error: "Kredensial tidak valid. Silakan periksa email dan kata sandi Anda." },
        { status: 401 }
      );
    }

    // 4. Verifikasi password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      logger.warn({ ip: clientIp, email, userId: user.id }, "Percobaan login gagal: password salah");
      return NextResponse.json(
        { error: "Kredensial tidak valid. Silakan periksa email dan kata sandi Anda." },
        { status: 401 }
      );
    }

    // Tentukan URL tujuan berdasarkan role user
    let redirectUrl = "/nasabah/dashboard";
    if (user.role === "petugas") {
      redirectUrl = "/petugas/deposits";
    } else if (user.role === "admin") {
      redirectUrl = "/admin/waste-categories";
    }

    // 5. Buat session cookie JWT
    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    logger.info({ ip: clientIp, userId: user.id, role: user.role }, "Login berhasil");

    return NextResponse.json({
      success: true,
      message: "Login berhasil.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      redirectUrl,
    });
  } catch (error) {
    logger.error({ error, ip: clientIp }, "Error pada proses login");
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server saat login." },
      { status: 500 }
    );
  }
}
