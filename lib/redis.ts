import { Redis, type RedisOptions } from "ioredis";
import { workerLogger } from "./logger";

/**
 * Membuat koneksi Redis baru dari REDIS_URL.
 * Dipakai oleh BullMQ (lib/queue.ts) dan worker (worker/index.ts) di minggu 2.
 *
 * - `maxRetriesPerRequest: null` WAJIB untuk BullMQ: perintah blocking milik
 *   Worker tidak boleh dibatasi jumlah retry-nya.
 * - URL berskema `rediss://` (Upstash) otomatis memakai TLS.
 */
export function createRedisConnection(overrides: RedisOptions = {}): Redis {
    const url = process.env.REDIS_URL;
    if (!url) {
        throw new Error("REDIS_URL belum diatur. Isi di file .env (lihat .env.example).");
    }

    const connection = new Redis(url, {
        maxRetriesPerRequest: null,
        ...overrides,
    });

    // Tanpa listener ini ioredis mencetak "Unhandled error event" tiap koneksi putus.
    connection.on("error", (err) => {
        workerLogger.error({ operation: "redis_connection", err }, "Koneksi Redis bermasalah");
    });

    return connection;
}

/** Cek koneksi cepat: PING lalu tulis dan baca satu key sementara. */
export async function checkRedisConnection(timeoutMs = 5000): Promise<{ latencyMs: number }> {
    // Mode gagal-cepat agar script cek tidak menggantung saat Redis mati.
    const connection = createRedisConnection({
        maxRetriesPerRequest: 1,
        connectTimeout: timeoutMs,
        retryStrategy: () => null,
        lazyConnect: true,
    });

    try {
        const startedAt = performance.now();
        await connection.connect();
        const pong = await connection.ping();
        if (pong !== "PONG") throw new Error(`Balasan PING tidak terduga: ${pong}`);

        const key = `healthcheck:${Date.now()}`;
        await connection.set(key, "ok", "EX", 10);
        const value = await connection.get(key);
        await connection.del(key);
        if (value !== "ok") throw new Error("Baca/tulis key uji ke Redis tidak konsisten.");

        return { latencyMs: Math.round(performance.now() - startedAt) };
    } finally {
        connection.disconnect();
    }
}