/**
 * Mengirim 1 notifikasi uji ke semua perangkat aktif milik satu user.
 * Dipakai untuk memastikan Service Worker dan langganan berfungsi,
 * tanpa menunggu worker BullMQ buatan Orang 3.
 *
 * Jalankan:  npx tsx --env-file=.env scripts/send-test-push.ts budi@mail.com
 */
import webpush from "web-push";
import { prisma } from "../lib/prisma";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Pemakaian: npx tsx --env-file=.env scripts/send-test-push.ts <email-user>");
        process.exitCode = 1;
        return;
    }

    const subject = process.env.VAPID_SUBJECT ?? "";
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
    const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const user = await prisma.user.findUnique({
        where: { email },
        include: { push_subscriptions: { where: { is_active: true } } },
    });
    if (!user) {
        console.error(`✘ User dengan email ${email} tidak ditemukan.`);
        process.exitCode = 1;
        return;
    }
    if (user.push_subscriptions.length === 0) {
        console.error("✘ User ini belum punya langganan aktif. Klik 'Aktifkan Notifikasi' di dashboard dulu.");
        process.exitCode = 1;
        return;
    }

    const payload = JSON.stringify({
        title: "Tes Notifikasi",
        body: `Halo ${user.name}, notifikasi Bank Sampah Digital berfungsi.`,
        url: "/nasabah/dashboard",
        tag: "test-push",
    });

    for (const sub of user.push_subscriptions) {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                payload
            );
            console.log(`✔ Terkirim ke ${sub.endpoint.slice(0, 60)}...`);
        } catch (error) {
            const statusCode = (error as { statusCode?: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } });
                console.log("✘ Langganan kedaluwarsa, dihapus dari database.");
            } else {
                console.error("✘ Gagal mengirim:", error);
            }
        }
    }
}

main()
    .catch((e) => {
        console.error("✘ Gagal:", e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());