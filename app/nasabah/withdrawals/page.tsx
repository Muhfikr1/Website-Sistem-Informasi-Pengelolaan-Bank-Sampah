import { getSession } from "@/lib/auth";
import { formatRupiah } from "@/lib/ui-format";
import { getDashboardSummary, getWithdrawalHistory } from "@/lib/nasabah-queries";
import { WithdrawalForm } from "./WithdrawalForm";

export const metadata = { title: "Penarikan Saldo" };
export const dynamic = "force-dynamic";

const STATUS_STYLE = {
  PENDING: { label: "Menunggu", className: "bg-amber-100 text-amber-800 border-amber-200" },
  APPROVED: { label: "Disetujui", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  REJECTED: { label: "Ditolak", className: "bg-red-100 text-red-800 border-red-200" },
} as const;

export default async function NasabahWithdrawalsPage() {
  const session = await getSession();
  const [summary, history] = await Promise.all([
    getDashboardSummary(session!.id),
    getWithdrawalHistory(session!.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Penarikan Saldo</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pengajuan akan diperiksa admin. Saldo baru berkurang setelah pengajuan disetujui.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <dt className="text-xs text-neutral-500">Saldo aktif</dt>
          <dd className="text-lg font-bold">{formatRupiah(summary.balance)}</dd>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <dt className="text-xs text-neutral-500">Menunggu persetujuan</dt>
          <dd className="text-lg font-bold">{formatRupiah(summary.pendingWithdrawals)}</dd>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <dt className="text-xs text-emerald-700">Bisa ditarik</dt>
          <dd className="text-lg font-bold text-emerald-800">{formatRupiah(summary.effectiveBalance)}</dd>
        </div>
      </dl>

      <WithdrawalForm effectiveBalance={summary.effectiveBalance} />

      <section aria-labelledby="wd-history" className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 id="wd-history" className="mb-4 text-lg font-bold text-neutral-900">Riwayat Pengajuan</h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            Belum ada pengajuan penarikan.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {history.map((w) => {
              const style = STATUS_STYLE[w.status];
              return (
                <li key={w.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-mono text-xs text-neutral-500">{w.code}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(w.requestedAt).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {w.status === "REJECTED" && w.rejectionReason && (
                      <p className="mt-1 text-xs text-red-600">Alasan: {w.rejectionReason}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatRupiah(w.amount)}</p>
                    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.className}`}>
                      {style.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}