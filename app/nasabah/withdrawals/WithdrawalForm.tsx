"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { formatRupiah } from "@/lib/ui-format";

export function WithdrawalForm({ effectiveBalance }: { effectiveBalance: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Validasi Lapis 1 (kenyamanan saja; server dan database memeriksa ulang)
  let problem: string | null = null;
  if (amount !== "") {
    if (!/^\d{1,12}$/.test(amount)) problem = "Hanya angka bulat tanpa titik, koma, atau huruf.";
    else if (Number(amount) <= 0) problem = "Nominal harus lebih dari Rp 0.";
    else if (Number(amount) > effectiveBalance) problem = `Melebihi saldo yang dapat ditarik (${formatRupiah(effectiveBalance)}).`;
  }
  const valid = amount !== "" && problem === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return; // cegah klik ganda
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal mengajukan penarikan.");
        return;
      }
      setSuccess(`Pengajuan ${data.withdrawal.withdrawalCode} berhasil dikirim dan menunggu persetujuan admin.`);
      setAmount("");
      router.refresh(); // muat ulang angka saldo dan riwayat
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-neutral-900">Ajukan Penarikan Saldo</h2>
      {error && <ErrorAlert message={error} />}
      {success && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </p>
      )}

      <div>
        <label htmlFor="amount" className="mb-1 block text-sm font-medium text-neutral-700">Nominal (Rp)</label>
        <input
          id="amount"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Contoh: 20000"
          value={amount}
          onChange={(e) => setAmount(e.target.value.trim())}
          aria-invalid={problem !== null}
          aria-describedby="amount-help"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <p id="amount-help" className={`mt-1 text-xs ${problem ? "text-red-600" : "text-neutral-500"}`}>
          {problem ?? `Maksimal ${formatRupiah(effectiveBalance)}`}
        </p>
      </div>

      <button
        type="submit"
        disabled={!valid || submitting}
        className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Mengirim..." : "Ajukan Penarikan"}
      </button>
    </form>
  );
}