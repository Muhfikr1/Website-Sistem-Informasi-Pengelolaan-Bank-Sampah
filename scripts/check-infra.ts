/**
 * Cek infrastruktur: env, kunci VAPID, Redis, Database, dan bucket Supabase.
 * Jalankan: npm run check:infra
 */
import webpush from "web-push";
import { prisma } from "../lib/prisma";
import { supabase, SUPABASE_PRIVATE_BUCKET, SUPABASE_PUBLIC_BUCKET } from "../lib/supabase";
import { checkRedisConnection } from "../lib/redis";

type CheckResult = { ok: boolean; detail: string };

const REQUIRED_ENV = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "REDIS_URL",
  "VAPID_SUBJECT",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];

// Nilai bawaan .env.example yang belum diganti.
const PLACEHOLDER_HINTS = ["[YOUR", "your-", "[PASSWORD]", "[PROJECT_REF]", "[ENDPOINT]"];

function checkEnv(): CheckResult {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  const placeholder = REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    return value && PLACEHOLDER_HINTS.some((hint) => value.includes(hint));
  });

  if (missing.length > 0) {
    return { ok: false, detail: `belum diisi: ${missing.join(", ")}` };
  }
  if (placeholder.length > 0) {
    return { ok: false, detail: `masih berisi contoh dari .env.example: ${placeholder.join(", ")}` };
  }
  return { ok: true, detail: `${REQUIRED_ENV.length} variabel terisi` };
}

function checkVapid(): CheckResult {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";
  try {
    // Melempar error jika format subject/kunci tidak valid.
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { ok: true, detail: "format subject, kunci publik, dan kunci privat valid" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis(): Promise<CheckResult> {
  try {
    const { latencyMs } = await checkRedisConnection();
    return { ok: true, detail: `PING + baca/tulis key berhasil (${latencyMs} ms)` };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `${reason} (cek REDIS_URL dan pastikan Redis menyala)` };
  }
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    const users = await prisma.user.count();
    return { ok: rows[0]?.ok === 1, detail: `terhubung, tabel users berisi ${users} baris` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message.split("\n").pop() ?? "" : String(err) };
  }
}

async function checkBuckets(): Promise<CheckResult> {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) return { ok: false, detail: error.message };

    const found = new Map(data.map((bucket) => [bucket.name, bucket]));
    const publicBucket = found.get(SUPABASE_PUBLIC_BUCKET);
    const privateBucket = found.get(SUPABASE_PRIVATE_BUCKET);

    const problems: string[] = [];
    if (!publicBucket) problems.push(`bucket '${SUPABASE_PUBLIC_BUCKET}' tidak ada`);
    else if (!publicBucket.public) problems.push(`bucket '${SUPABASE_PUBLIC_BUCKET}' harus Public`);
    if (!privateBucket) problems.push(`bucket '${SUPABASE_PRIVATE_BUCKET}' tidak ada`);
    else if (privateBucket.public) problems.push(`bucket '${SUPABASE_PRIVATE_BUCKET}' harus Private`);

    if (problems.length > 0) return { ok: false, detail: problems.join("; ") };
    return {
      ok: true,
      detail: `'${SUPABASE_PUBLIC_BUCKET}' (public) dan '${SUPABASE_PRIVATE_BUCKET}' (private) siap`,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const checks: [string, () => CheckResult | Promise<CheckResult>][] = [
    ["Variabel .env", checkEnv],
    ["Kunci VAPID", checkVapid],
    ["Redis", checkRedis],
    ["Database PostgreSQL", checkDatabase],
    ["Supabase Storage", checkBuckets],
  ];

  let failed = 0;
  for (const [label, run] of checks) {
    const result = await run();
    if (!result.ok) failed += 1;
    console.log(`${result.ok ? "[OK]   " : "[GAGAL]"} ${label}: ${result.detail}`);
  }

  console.log(failed === 0 ? "\nSemua pemeriksaan lulus." : `\n${failed} pemeriksaan gagal.`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});