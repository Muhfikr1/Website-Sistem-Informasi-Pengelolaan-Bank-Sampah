import pino, { type Logger } from "pino";

const logLevel = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level: logLevel,
  redact: {
    paths: [
      "password",
      "password_hash",
      "token",
      "cookie",
      "VAPID_PRIVATE_KEY",
      "*.password",
      "*.password_hash",
      "*.token",
      "*.cookie",
      "*.VAPID_PRIVATE_KEY",
      "headers.cookie",
      "headers.authorization",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
  // Tanpa serializer, objek Error tercatat sebagai {} (kosong).
  // Dengan ini field `err` dan `error` berisi type, message, dan stack.
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type LogContext = "API" | "WORKER" | "SEED" | "SCRIPT";

/** Logger anak: setiap baris log otomatis membawa field `context`. */
export function createContextLogger(context: LogContext): Logger {
  return logger.child({ context });
}

export const apiLogger = createContextLogger("API");
export const workerLogger = createContextLogger("WORKER");

/**
 * Stopwatch sederhana untuk handler yang sulit dibungkus fungsi.
 *   const stop = startTimer();
 *   ...
 *   log.info({ operation: "x", duration_ms: stop() }, "selesai");
 */
export function startTimer(): () => number {
  const startedAt = performance.now();
  return () => Math.round(performance.now() - startedAt);
}

/**
 * Menjalankan operasi async dan mencatat durasinya (duration_ms).
 * Error dicatat lalu dilempar ulang, jadi pemanggil tetap bisa menanganinya.
 */
export async function logTimed<T>(
  log: Logger,
  operation: string,
  fn: () => Promise<T>,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const stop = startTimer();
  try {
    const result = await fn();
    log.info({ operation, duration_ms: stop(), ...extra }, `${operation} selesai`);
    return result;
  } catch (err) {
    log.error({ operation, duration_ms: stop(), err, ...extra }, `${operation} gagal`);
    throw err;
  }
}

export default logger;