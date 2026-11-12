/* Service Worker Bank Sampah Digital: menerima Web Push dan menampilkan notifikasi.
 *
 * Format payload yang dikirim worker (Orang 3), JSON:
 *   { "title": "Setoran Berhasil", "body": "Saldo bertambah Rp 10.000",
 *     "url": "/nasabah/dashboard", "tag": "deposit-123" }
 * Semua field opsional; url hanya boleh mengarah ke situs yang sama.
 */
const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_URL = "/nasabah/dashboard";

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch {
            data = { body: event.data.text() };
        }
    }

    const title = data.title || "Bank Sampah Digital";
    const options = {
        body: data.body || "Anda memiliki pembaruan baru.",
        icon: data.icon || DEFAULT_ICON,
        badge: DEFAULT_ICON,
        data: { url: data.url || DEFAULT_URL },
    };
    if (data.tag) options.tag = data.tag;

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    // Tolak URL ke situs lain: kembalikan ke halaman default
    let target = new URL(DEFAULT_URL, self.location.origin);
    try {
        const requested = new URL(event.notification.data && event.notification.data.url, self.location.origin);
        if (requested.origin === self.location.origin) target = requested;
    } catch {
        /* pakai URL default */
    }

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            for (const client of windows) {
                if (new URL(client.url).origin === self.location.origin && "focus" in client) {
                    await client.focus();
                    if ("navigate" in client) await client.navigate(target.href);
                    return;
                }
            }
            await self.clients.openWindow(target.href);
        })()
    );
});