/**
 * Membuktikan laporan rekapitulasi admin BEBAS N+1 query.
 *
 * Skrip menghitung berapa banyak query DATA (SELECT/INSERT/UPDATE/DELETE) yang dijalankan getAdminReport().
 * Jika ada N+1, jumlahnya akan naik mengikuti banyaknya kategori atau nasabah.
 * Pada implementasi ini jumlahnya TETAP 5 berapa pun besarnya data.
 *
 * Perintah kontrol seperti BEGIN, COMMIT, dan DEALLOCATE ALL tidak dihitung: itu ditambahkan
 * Prisma saat memakai pooler Supabase (pgbouncer) dan bukan query data.
 *
 * Jalankan:  npx tsx --env-file=.env scripts/check-report-queries.ts
 */
import { PrismaClient } from "@prisma/client";
import { getAdminReport } from "../lib/report-queries";

const EXPECTED_DATA_QUERIES = 5;

/** Perintah pengatur koneksi/transaksi, bukan pengambilan data. */
const isControlStatement = (sql: string) =>
  /^(BEGIN|COMMIT|ROLLBACK|DEALLOCATE|SET|RESET|SAVEPOINT|RELEASE|DISCARD)\b/i.test(sql.trim());

async function main() {
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  const statements: string[] = [];
  client.$on("query", (event) => statements.push(event.query.replace(/\s+/g, " ")));

  const startedAt = Date.now();
  const report = await getAdminReport({}, client);
  const elapsed = Date.now() - startedAt;

  const dataQueries = statements.filter((sql) => !isControlStatement(sql));
  const controlCount = statements.length - dataQueries.length;

  console.log("Data yang dilaporkan");
  console.log(`  Jenis sampah : ${report.categories.length}`);
  console.log(`  Nasabah      : ${report.balances.nasabahCount}`);
  console.log(`  Setoran      : ${report.deposits.count}`);
  console.log(`\nQuery data yang dijalankan (${dataQueries.length}) dalam ${elapsed} ms:`);
  dataQueries.forEach((sql, index) => console.log(`  ${index + 1}. ${sql.slice(0, 110)}...`));
  if (controlCount > 0) {
    console.log(`\n(${controlCount} perintah BEGIN/COMMIT/DEALLOCATE dari pooler diabaikan, bukan query data.)`);
  }

  if (dataQueries.length === EXPECTED_DATA_QUERIES) {
    console.log(`\n✔ BEBAS N+1: tepat ${EXPECTED_DATA_QUERIES} query data, tidak bergantung pada jumlah data.`);
  } else {
    console.log(
      `\n✘ Jumlah query data ${dataQueries.length}, seharusnya ${EXPECTED_DATA_QUERIES}. Periksa lib/report-queries.ts.`
    );
    process.exitCode = 1;
  }
  await client.$disconnect();
}

main().catch((error) => {
  console.error("✘ Gagal:", error);
  process.exitCode = 1;
});
