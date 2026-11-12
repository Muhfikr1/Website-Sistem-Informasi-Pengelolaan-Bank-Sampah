"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FolderKanban, Loader2, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { formatRupiah } from "@/lib/ui-format";
import WasteCategoryFormDialog from "./WasteCategoryFormDialog";
import type { WasteCategoryRow } from "./types";

type FormState = { mode: "create" } | { mode: "edit"; item: WasteCategoryRow } | null;
type Notice = { type: "success" | "error"; text: string } | null;

function ConfirmDeleteDialog({
    item,
    busy,
    onCancel,
    onConfirm,
}: {
    item: WasteCategoryRow;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (dialog && !dialog.open) dialog.showModal();
    }, []);

    return (
        <dialog
            ref={ref}
            onCancel={(event) => {
                event.preventDefault();
                onCancel();
            }}
            aria-labelledby="delete-dialog-title"
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/40"
        >
            <div className="p-6">
                <h2 id="delete-dialog-title" className="text-lg font-bold">Hapus jenis sampah?</h2>
                <p className="mt-2 text-sm text-neutral-600">
                    <strong>{item.code} - {item.name}</strong> akan dihapus permanen beserta fotonya. Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        Ya, Hapus
                    </button>
                </div>
            </div>
        </dialog>
    );
}

export default function WasteCategoryManager({ items }: { items: WasteCategoryRow[] }) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [form, setForm] = useState<FormState>(null);
    const [deleting, setDeleting] = useState<WasteCategoryRow | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice>(null);

    const keyword = query.trim().toLowerCase();
    const visible = keyword
        ? items.filter((i) => i.code.toLowerCase().includes(keyword) || i.name.toLowerCase().includes(keyword))
        : items;

    async function readError(response: Response, fallback: string): Promise<string> {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        return data?.error ?? fallback;
    }

    async function toggleActive(item: WasteCategoryRow) {
        setBusyId(item.id);
        setNotice(null);
        try {
            const body = new FormData();
            body.set("is_active", String(!item.isActive));
            const response = await fetch(`/api/admin/waste-categories/${item.id}`, { method: "PATCH", body });
            if (!response.ok) {
                setNotice({ type: "error", text: await readError(response, "Gagal mengubah status.") });
                return;
            }
            setNotice({
                type: "success",
                text: `${item.code} sekarang ${item.isActive ? "nonaktif" : "aktif"}.`,
            });
            router.refresh();
        } catch {
            setNotice({ type: "error", text: "Tidak dapat terhubung ke server." });
        } finally {
            setBusyId(null);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        const item = deleting;
        setBusyId(item.id);
        setNotice(null);
        try {
            const response = await fetch(`/api/admin/waste-categories/${item.id}`, { method: "DELETE" });
            if (!response.ok) {
                setNotice({ type: "error", text: await readError(response, "Gagal menghapus jenis sampah.") });
            } else {
                setNotice({ type: "success", text: `${item.code} berhasil dihapus.` });
                router.refresh();
            }
        } catch {
            setNotice({ type: "error", text: "Tidak dapat terhubung ke server." });
        } finally {
            setBusyId(null);
            setDeleting(null);
        }
    }

    const iconButton =
        "rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40";

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                    <label htmlFor="cat-search" className="sr-only">Cari jenis sampah</label>
                    <input
                        id="cat-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari kode atau nama…"
                        className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setNotice(null);
                        setForm({ mode: "create" });
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Tambah Jenis
                </button>
            </div>

            {notice && (
                <div role="status" aria-live="polite">
                    {notice.type === "error" ? (
                        <ErrorAlert title="Tindakan gagal" message={notice.text} />
                    ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                            <CheckCircle2 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                            <span className="flex-1">{notice.text}</span>
                            <button type="button" onClick={() => setNotice(null)} aria-label="Tutup pesan" className="rounded p-1 hover:bg-emerald-100">
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {items.length === 0 ? (
                <EmptyState
                    icon={FolderKanban}
                    title="Belum ada jenis sampah"
                    description="Tambahkan jenis sampah pertama agar tampil di katalog dan bisa dipilih petugas."
                />
            ) : visible.length === 0 ? (
                <EmptyState icon={Search} title="Tidak ada hasil" description={`Tidak ada jenis sampah yang cocok dengan "${query}".`} />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <caption className="sr-only">Daftar jenis sampah dan harga per kilogram</caption>
                        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                            <tr>
                                <th scope="col" className="px-4 py-3">Foto</th>
                                <th scope="col" className="px-4 py-3">Kode</th>
                                <th scope="col" className="px-4 py-3">Nama</th>
                                <th scope="col" className="px-4 py-3">Harga / kg</th>
                                <th scope="col" className="px-4 py-3">Status</th>
                                <th scope="col" className="px-4 py-3">Dipakai</th>
                                <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {visible.map((item) => {
                                const busy = busyId === item.id;
                                return (
                                    <tr key={item.id} className={item.isActive ? "" : "bg-neutral-50 text-neutral-500"}>
                                        <td className="px-4 py-3">
                                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-emerald-50 text-emerald-300">
                                                {item.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={item.imageUrl} alt={`Foto ${item.name}`} loading="lazy" className="h-full w-full object-cover" />
                                                ) : (
                                                    <FolderKanban className="h-5 w-5" aria-hidden="true" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                                        <td className="px-4 py-3 font-medium text-neutral-900">{item.name}</td>
                                        <td className="px-4 py-3 font-semibold">{formatRupiah(item.price)}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
                                                    }`}
                                            >
                                                {item.isActive ? "Aktif" : "Nonaktif"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{item.usedCount} item</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                {busy ? (
                                                    <Loader2 className="m-2 h-5 w-5 animate-spin text-neutral-400" aria-label="Memproses" />
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNotice(null);
                                                                setForm({ mode: "edit", item });
                                                            }}
                                                            aria-label={`Ubah ${item.name}`}
                                                            title="Ubah"
                                                            className={iconButton}
                                                        >
                                                            <Pencil className="h-4 w-4" aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleActive(item)}
                                                            aria-label={item.isActive ? `Nonaktifkan ${item.name}` : `Aktifkan ${item.name}`}
                                                            title={item.isActive ? "Nonaktifkan" : "Aktifkan"}
                                                            className={iconButton}
                                                        >
                                                            <Power className="h-4 w-4" aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleting(item)}
                                                            disabled={item.usedCount > 0}
                                                            aria-label={`Hapus ${item.name}`}
                                                            title={item.usedCount > 0 ? "Sudah dipakai di setoran, nonaktifkan saja" : "Hapus"}
                                                            className={`${iconButton} hover:text-red-600`}
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {form && (
                <WasteCategoryFormDialog
                    mode={form.mode}
                    item={form.mode === "edit" ? form.item : undefined}
                    onClose={() => setForm(null)}
                    onSaved={(text) => {
                        setForm(null);
                        setNotice({ type: "success", text });
                        router.refresh();
                    }}
                />
            )}

            {deleting && (
                <ConfirmDeleteDialog
                    item={deleting}
                    busy={busyId === deleting.id}
                    onCancel={() => setDeleting(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </div>
    );
}