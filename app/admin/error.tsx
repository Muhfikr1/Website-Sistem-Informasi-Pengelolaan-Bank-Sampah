"use client";

import ErrorAlert from "@/components/ui/ErrorAlert";

export default function Error({ reset }: { error: Error; reset: () => void }) {
    return (
        <ErrorAlert
            title="Halaman gagal dimuat"
            message="Terjadi masalah saat mengambil data. Periksa koneksi Anda lalu coba lagi."
            onRetry={reset}
        />
    );
}