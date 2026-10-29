import { NextRequest, NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup memori otomatis setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  limit?: number; // Jumlah maksimum permintaan
  windowMs?: number; // Periode jendela waktu dalam milidetik
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * In-memory sliding rate limiter untuk membatasi request abuse
 * @param key Identifier unik (misal: IP address atau user ID + prefix endpoint)
 * @param options Konfigurasi batasan limit dan jendela waktu
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60 * 1000; // default 1 menit
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, newRecord);

    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Ekstraksi IP address dari NextRequest
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Response helper jika rate limit terlampaui (HTTP 429)
 */
export function createRateLimitResponse(resetSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Terlalu banyak permintaan (Too Many Requests). Silakan coba lagi nanti.",
      retryAfter: resetSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetSeconds),
        "Content-Type": "application/json",
      },
    }
  );
}

