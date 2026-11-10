import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "nasabah" | "petugas" | "admin";

export interface SessionPayload {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const COOKIE_NAME = "bank_sampah_session";
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "bank-sampah-secret-jwt-key-2026"
);

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      id: String(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function createSession(user: {
  id: string | number;
  name: string;
  email: string;
  role: Role;
}) {
  const token = await new SignJWT({
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 hari
  });

  return token;
}

export async function getSession(request?: Request): Promise<SessionPayload | null> {
  let token: string | undefined;

  if (request) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
      token = match ? decodeURIComponent(match[1]) : undefined;
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // Dipanggil di luar request context
      return null;
    }
  }

  if (!token) return null;
  return verifyToken(token);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
