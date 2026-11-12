"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { urlBase64ToUint8Array } from "@/lib/push-utils";

type PushStatus = "checking" | "unsupported" | "no-key" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isConfiguredKey(key: string): boolean {
    // Nilai contoh dari .env.example tidak dianggap kunci yang valid
    return key.length > 20 && !key.startsWith("your-");
}

async function getRegistration() {
    return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

async function postSubscription(sub: PushSubscription): Promise<Response> {
    return fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
    });
}

/** Mendeteksi kondisi awal: didukung atau tidak, diizinkan atau diblokir, sudah berlangganan atau belum. */
async function detectStatus(): Promise<{ status: PushStatus; subscription: PushSubscription | null }> {
    if (!isConfiguredKey(VAPID_PUBLIC_KEY)) return { status: "no-key", subscription: null };
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return { status: "unsupported", subscription: null };
    }
    if (Notification.permission === "denied") return { status: "denied", subscription: null };

    const registration = await getRegistration();
    const subscription = (await registration?.pushManager.getSubscription()) ?? null;
    if (subscription && Notification.permission === "granted") return { status: "on", subscription };
    return { status: "off", subscription: null };
}

export default function PushToggle() {
    const [status, setStatus] = useState<PushStatus>("checking");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await detectStatus();
            if (cancelled) return;
            setStatus(result.status);
            // Perangkat ini sudah berlangganan: klaim ulang ke akun yang sedang login.
            // Berguna jika perangkat dipakai bergantian oleh beberapa akun.
            if (result.status === "on" && result.subscription) {
                postSubscription(result.subscription).catch(() => undefined);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function enable() {
        setBusy(true);
        setMessage(null);
        try {
            const permission = await Notification.requestPermission();
            if (permission === "denied") {
                setStatus("denied");
                return;
            }
            if (permission !== "granted") {
                setMessage("Izin notifikasi belum diberikan.");
                return;
            }

            await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            const registration = await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
            }

            const response = await postSubscription(subscription);
            if (!response.ok) {
                // Server gagal menyimpan: batalkan langganan di browser agar status tetap konsisten
                await subscription.unsubscribe();
                const data = (await response.json().catch(() => null)) as { error?: string } | null;
                setMessage(data?.error ?? "Gagal menyimpan langganan. Coba lagi.");
                return;
            }
            setStatus("on");
        } catch (error) {
            console.error("Gagal mengaktifkan notifikasi:", error);
            setMessage("Gagal mengaktifkan notifikasi. Coba lagi.");
        } finally {
            setBusy(false);
        }
    }

    async function disable() {
        setBusy(true);
        setMessage(null);
        try {
            const registration = await getRegistration();
            const subscription = await registration?.pushManager.getSubscription();
            if (subscription) {
                await fetch("/api/push/subscribe", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
                await subscription.unsubscribe();
            }
            setStatus("off");
        } catch (error) {
            console.error("Gagal mematikan notifikasi:", error);
            setMessage("Gagal mematikan notifikasi. Coba lagi.");
        } finally {
            setBusy(false);
        }
    }

    const base =
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors";

    let control: React.ReactNode;
    if (status === "checking") {
        control = (
            <span className={`${base} border-neutral-200 text-neutral-400`} aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Memeriksa…</span>
            </span>
        );
    } else if (status === "unsupported") {
        control = (
            <span className={`${base} border-neutral-200 bg-neutral-50 text-neutral-500`} title="Gunakan Chrome, Edge, atau Firefox terbaru.">
                <BellOff className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Browser tidak mendukung notifikasi</span>
                <span className="sr-only sm:hidden">Browser tidak mendukung notifikasi</span>
            </span>
        );
    } else if (status === "no-key") {
        control = (
            <span className={`${base} border-amber-200 bg-amber-50 text-amber-800`} title="NEXT_PUBLIC_VAPID_PUBLIC_KEY belum diisi di .env">
                <BellOff className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Notifikasi belum dikonfigurasi</span>
                <span className="sr-only sm:hidden">Notifikasi belum dikonfigurasi</span>
            </span>
        );
    } else if (status === "denied") {
        control = (
            <span
                className={`${base} border-red-200 bg-red-50 text-red-700`}
                title="Buka pengaturan situs di browser, lalu ubah izin Notifikasi menjadi Izinkan."
            >
                <BellOff className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Notifikasi diblokir browser</span>
                <span className="sr-only sm:hidden">Notifikasi diblokir browser. Ubah izin di pengaturan situs.</span>
            </span>
        );
    } else if (status === "on") {
        control = (
            <button
                type="button"
                onClick={disable}
                disabled={busy}
                aria-label="Notifikasi aktif. Klik untuk mematikan."
                className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60`}
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BellRing className="h-4 w-4" aria-hidden="true" />}
                <span className="hidden sm:inline">Notifikasi Aktif</span>
            </button>
        );
    } else {
        control = (
            <button
                type="button"
                onClick={enable}
                disabled={busy}
                aria-label="Aktifkan notifikasi"
                className={`${base} border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-60`}
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
                <span className="hidden sm:inline">Aktifkan Notifikasi</span>
            </button>
        );
    }

    return (
        <div className="relative">
            {control}
            {message && (
                <p
                    role="alert"
                    className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow"
                >
                    {message}
                </p>
            )}
        </div>
    );
}