/** Menampilkan jumlah job di antrean web-push. Pakai: npm run queue:status */
import { getPushQueue, closePushQueue } from "../lib/queue";

async function main() {
  const counts = await getPushQueue().getJobCounts("waiting", "active", "delayed", "completed", "failed");
  console.table(counts);
}

main()
  .catch((e) => {
    console.error("Tidak bisa membaca antrean:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closePushQueue());