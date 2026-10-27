import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "bank_sampah_session";
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "bank-sampah-secret-jwt-key-2026"
);

interface TokenPayload {
  id: string;
  name: string;
  email: string;
  role: "nasabah" | "petugas" | "admin";
}

async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      id: String(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as "nasabah" | "petugas" | "admin",
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // 1. Redirect user yang sudah login jika mengakses halaman login / register
  if (pathname === "/login" || pathname === "/register") {
    if (session) {
      if (session.role === "nasabah") {
        return NextResponse.redirect(new URL("/nasabah/dashboard", request.url));
      } else if (session.role === "petugas") {
        return NextResponse.redirect(new URL("/petugas/deposits", request.url));
      } else if (session.role === "admin") {
        return NextResponse.redirect(new URL("/admin/waste-categories", request.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Proteksi rute berdasarkan peran
  const protectedConfigs = [
    { prefix: "/nasabah", role: "nasabah" as const },
    { prefix: "/petugas", role: "petugas" as const },
    { prefix: "/admin", role: "admin" as const },
  ];

  for (const config of protectedConfigs) {
    if (pathname.startsWith(config.prefix)) {
      // Jika belum login
      if (!session) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Jika role tidak sesuai
      if (session.role !== config.role) {
        const forbiddenUrl = new URL("/forbidden", request.url);
        forbiddenUrl.searchParams.set("role", session.role);
        forbiddenUrl.searchParams.set(
          "reason",
          `Akses ditolak. Rute ${pathname} membutuhkan hak akses [${config.role}], sedangkan akun Anda saat ini terdaftar sebagai [${session.role}].`
        );
        return NextResponse.redirect(forbiddenUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/nasabah/:path*",
    "/petugas/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
