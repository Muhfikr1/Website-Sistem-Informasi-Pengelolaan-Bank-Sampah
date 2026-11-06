"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorAlertProps {
    title?: string;
    message: string;
    /** Jika diisi, tombol "Coba Lagi" tampil. */
    onRetry?: () => void;
}

/** Kotak pesan error merah. role="alert" agar dibacakan screen reader. */
export default function ErrorAlert({
    title = "Terjadi kesalahan",
    message,
    onRetry,
}: ErrorAlertProps) {
    return (
        <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
            <div className="flex-1">
                <p className="font-semibold">{title}</p>
                <p className="mt-0.5 text-red-700">{message}</p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Coba Lagi
                    </button>
                )}
            </div>
        </div>
    );
}