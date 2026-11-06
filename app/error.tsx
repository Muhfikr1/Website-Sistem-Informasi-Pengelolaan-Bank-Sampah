"use client";

import ErrorAlert from "@/components/ui/ErrorAlert";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
    return (
        <main id="main-content" className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
            <div className="w-full max-w-md">
                <ErrorAlert
                    title="Terjadi kesalahan pada aplikasi"
                    message="Maaf, halaman ini tidak dapat ditampilkan. Silakan coba lagi."
                    onRetry={reset}
                />
            </div>
        </main>
    );
}