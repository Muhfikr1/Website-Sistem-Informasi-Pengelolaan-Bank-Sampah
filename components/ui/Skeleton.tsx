/** Kotak abu-abu berdenyut sebagai placeholder saat data dimuat. */
export function Skeleton({ className = "" }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse rounded-lg bg-neutral-200 ${className}`}
        />
    );
}

/** Skeleton satu halaman penuh: judul + kartu + tabel. Dipakai di loading.tsx. */
export function PageSkeleton() {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
            <span className="sr-only">Memuat halaman…</span>
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6">
                <Skeleton className="h-6 w-48" />
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        </div>
    );
}