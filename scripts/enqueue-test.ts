/**
 * Memasukkan 1 job uji ke antrean web-push.
 * Pakai:  npm run queue:enqueue-test -- <email-nasabah>
 * Contoh: npm run queue:enqueue-test -- budi@mail.com
 */
import { prisma } from "../lib/prisma";
import { enqueuePushNotification, closePushQueue } from "../lib/queue";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Pakai: npm run queue:enqueue-test -- <email-nasabah>");
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) {
    console.error(`Pengguna dengan email ${email} tidak ditemukan.`);
    process.exitCode = 1;
    return;
  }
  const ok = await enqueuePushNotification(
    {
      type: "DEPOSIT_VALIDATED",
      userId: user.id,
      title: "Tes Notifikasi",
      body: `Halo ${user.name}, ini notifikasi uji dari antrean.`,
      url: "/nasabah/dashboard",
    },
    `enqueue-test-${Date.now()}`
  );
  console.log(ok ? "OK: job masuk antrean." : "GAGAL: job tidak masuk antrean (lihat log di atas).");
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePushQueue();
    await prisma.$disconnect();
  });