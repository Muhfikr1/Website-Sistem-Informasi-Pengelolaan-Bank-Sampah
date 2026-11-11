"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { formatRupiah } from "@/lib/ui-format";

interface NasabahOption {
    id: string;
    name: string;
    email: string;
}
interface CategoryOption {
    id: string;
    code: string;
    name: string;
    pricePerKg: number;
}
interface Row {
    key: number;
    categoryId: string;
    weight: string;
}
interface Success {
    transactionCode: string;
    nasabahName: string;
    totalWeightKg: string;
    totalAmount: string;
    balanceAfter: string;
    notificationQueued: boolean;
}

const WEIGHT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export function DepositForm({
    nasabah,
    categories,
}: {
    nasabah: NasabahOption[];
    categories: CategoryOption[];
}) {
    const [nasabahId, setNasabahId] = useState("");
    const [rows, setRows] = useState<Row[]>([{ key: 1, categoryId: "", weight: "" }]);
    const [nextKey, setNextKey] = useState(2);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<Success | null>(null);

    const priceOf = useMemo(() => new Map(categories.map((c) => [c.id, c.pricePerKg])), [categories]);

    // Validasi Lapis 1 (cepat, hanya untuk kenyamanan; server tetap memeriksa ulang)
    function rowProblem(row: Row, index: number): string | null {
        if (!row.categoryId) return "Pilih kategori.";
        if (!WEIGHT_PATTERN.test(row.weight) || Number(row.weight) <= 0) return "Berat harus > 0, maksimal 2 desimal (pakai titik).";
        if (rows.some((r, i) => i !== index && r.categoryId === row.categoryId)) return "Kategori ganda.";
        return null;
    }

    const estimate = rows.reduce((sum, row) => {
        const price = priceOf.get(row.categoryId);
        const w = WEIGHT_PATTERN.test(row.weight) ? Number(row.weight) : 0;
        return price ? sum + Math.round(w * price * 100) / 100 : sum;
    }, 0);

    const formValid = nasabahId !== "" && rows.every((r, i) => rowProblem(r, i) === null);

    function updateRow(key: number, patch: Partial<Row>) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formValid || submitting) return; // cegah klik ganda
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/deposits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nasabah_id: nasabahId,
                    items: rows.map((r) => ({ waste_category_id: r.categoryId, weight_kg: r.weight.trim() })),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error ?? "Gagal menyimpan setoran.");
                return;
            }
            setSuccess({ ...data.deposit, notificationQueued: data.notificationQueued });
        } catch {
            setError("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
        } finally {
            setSubmitting(false);
        }
    }

    function reset() {
        setSuccess(null);
        setNasabahId("");
        setRows([{ key: nextKey, categoryId: "", weight: "" }]);
        setNextKey((k) => k + 1);
    }

    if (success) {
        return (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-5">
                <h2 className="text-lg font-semibold text-green-800">Setoran berhasil dicatat</h2>
                <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt>Kode transaksi</dt><dd className="font-mono">{success.transactionCode}</dd></div>
                    <div className="flex justify-between"><dt>Nasabah</dt><dd>{success.nasabahName}</dd></div>
                    <div className="flex justify-between"><dt>Total berat</dt><dd>{success.totalWeightKg} kg</dd></div>
                    <div className="flex justify-between"><dt>Total nilai</dt><dd className="font-semibold">{formatRupiah(Number(success.totalAmount))}</dd></div>
                    <div className="flex justify-between"><dt>Saldo nasabah sekarang</dt><dd>{formatRupiah(Number(success.balanceAfter))}</dd></div>
                </dl>
                {!success.notificationQueued && (
                    <p className="text-xs text-amber-700">Setoran tersimpan, tetapi notifikasi belum bisa dijadwalkan (antrean sedang bermasalah).</p>
                )}
                <div className="flex gap-2 pt-2">
                    <button onClick={reset} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Catat setoran lagi</button>
                    <Link href="/petugas/deposits" className="rounded-md border px-4 py-2 text-sm">Lihat daftar</Link>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border bg-white p-5">
            {error && <ErrorAlert message={error} />}

            <div>
                <label htmlFor="nasabah" className="mb-1 block text-sm font-medium">Nasabah</label>
                <select
                    id="nasabah"
                    value={nasabahId}
                    onChange={(e) => setNasabahId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                >
                    <option value="">-- Pilih nasabah --</option>
                    {nasabah.map((n) => (
                        <option key={n.id} value={n.id}>{n.name} ({n.email})</option>
                    ))}
                </select>
            </div>

            <div className="space-y-3">
                <p className="text-sm font-medium">Jenis sampah</p>
                {rows.map((row, index) => {
                    const problem = rowProblem(row, index);
                    const touched = row.categoryId !== "" || row.weight !== "";
                    return (
                        <div key={row.key} className="space-y-1">
                            <div className="flex gap-2">
                                <select
                                    aria-label="Kategori sampah"
                                    value={row.categoryId}
                                    onChange={(e) => updateRow(row.key, { categoryId: e.target.value })}
                                    className="flex-1 rounded-md border px-3 py-2 text-sm"
                                >
                                    <option value="">-- Kategori --</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name} ({formatRupiah(c.pricePerKg)}/kg)</option>
                                    ))}
                                </select>
                                <input
                                    aria-label="Berat (kg)"
                                    inputMode="decimal"
                                    placeholder="Berat kg"
                                    value={row.weight}
                                    onChange={(e) => updateRow(row.key, { weight: e.target.value })}
                                    className="w-28 rounded-md border px-3 py-2 text-sm"
                                />
                                <button
                                    type="button"
                                    disabled={rows.length === 1}
                                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                                    className="rounded-md border px-3 text-sm disabled:opacity-40"
                                    aria-label="Hapus baris"
                                >✕</button>
                            </div>
                            {touched && problem && <p className="text-xs text-red-600">{problem}</p>}
                        </div>
                    );
                })}
                <button
                    type="button"
                    disabled={rows.length >= 20}
                    onClick={() => {
                        setRows((prev) => [...prev, { key: nextKey, categoryId: "", weight: "" }]);
                        setNextKey((k) => k + 1);
                    }}
                    className="text-sm text-green-700 hover:underline disabled:opacity-40"
                >+ Tambah jenis sampah</button>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
                <div>
                    <p className="text-xs text-gray-500">Estimasi total (dihitung ulang oleh server)</p>
                    <p className="text-lg font-semibold">{formatRupiah(estimate)}</p>
                </div>
                <button
                    type="submit"
                    disabled={!formValid || submitting}
                    className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {submitting ? "Menyimpan..." : "Simpan Setoran"}
                </button>
            </div>
        </form>
    );
}

export default DepositForm;

