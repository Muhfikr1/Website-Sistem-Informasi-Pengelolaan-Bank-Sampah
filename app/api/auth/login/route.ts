import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kredensial tidak valid. Silakan periksa email dan kata sandi Anda." },
        { status: 401 }
      );
    }

    // Verifikasi password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
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

    // Buat session cookie JWT
    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

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
    console.error("Error pada proses login:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server saat login." },
      { status: 500 }
    );
  }
}
