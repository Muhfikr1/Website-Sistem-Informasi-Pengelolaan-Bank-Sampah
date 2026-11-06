import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: ReactNode;
}

/** Tampilan saat data kosong (tabel kosong, belum ada riwayat, dll). */
export default function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            {description && (
                <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}