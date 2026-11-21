import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Banknote, CheckCircle2, Clock, Scale, Wallet, XCircle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { getAdminReport, type AdminReport } from "@/lib/report-queries";
import { resolveReportRange } from "@/lib/validation/report";
import { formatKg, formatPercent, formatRupiah } from "@/lib/ui-format";
import EmptyState from "@/components/ui/EmptyState";
import ErrorAlert from "@/components/ui/ErrorAlert";

export const metadata = { title: "Laporan Rekapitulasi" };
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function periodLabel(from?: string, to?: string): string {
  const show = (value: string) => dateFormatter.format(new Date(`${value}T12:00:00+07:00`));
  if (from && to) return `${show(from)} sampai ${show(to)}`;
  if (from) return `Sejak ${show(from)}`;
  if (to) return `Sampai ${show(to)}`;
  return "Semua waktu";
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Lapis tambahan di atas middleware dan layout: laporan berisi data keuangan seluruh nasabah.
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/forbidden");

  const { query, range, error: rangeError } = resolveReportRange(await searchParams);

  let report: AdminReport | null = null;
  try {
    report = await getAdminReport(range);
  } catch (error) {
    apiLogger.error({ error, operation: "admin.reports.load", userId: session.id }, "Gagal memuat laporan rekapitulasi");
  }

  const inputClass = "rounded-lg border border-neutral-300 px-3 py-1.5 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Laporan Rekapitulasi</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Rekap berat sampah, nilai setoran, penarikan, dan saldo seluruh nasabah.
        </p>
      </div>

      {/* Filter periode: form GET biasa, jadi bisa dipakai dengan keyboard (Tab dan Enter) */}
      <form
        method="get"
        aria-label="Filter periode laporan"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <div>
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-neutral-600">Dari tanggal</label>
          <input id="from" name="from" type="date" defaultValue={query.from ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-neutral-600">Sampai tanggal</label>
          <input id="to" name="to" type="date" defaultValue={query.to ?? ""} className={inputClass} />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Terapkan filter
        </button>
        <Link
          href="/admin/reports"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Reset
        </Link>
        {rangeError && (
          <p role="alert" className="w-full text-xs text-red-600">
            {rangeError}
          </p>
        )}
      </form>

      {!report ? (
        <ErrorAlert
          title="Laporan gagal dimuat"
          message="Data rekapitulasi belum bisa diambil. Muat ulang halaman beberapa saat lagi."
        />
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            Periode: <strong className="text-neutral-900">{periodLabel(query.from, query.to)}</strong>
          </p>

          {/* Ringkasan */}
          <section aria-label="Ringkasan laporan">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-200/60 bg-blue-50/60 p-5">
                <dt className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                  <Scale className="h-5 w-5 text-blue-600" /> Total Berat Sampah
                </dt>
                <dd className="mt-2 text-2xl font-bold text-blue-800">{formatKg(report.deposits.totalWeightKg)} kg</dd>
                <dd className="mt-1 text-xs text-neutral-600">Dari {report.deposits.count} kali setoran</dd>
              </div>

              <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-5">
                <dt className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <Banknote className="h-5 w-5 text-emerald-600" /> Total Nilai Setoran
                </dt>
                <dd className="mt-2 text-2xl font-bold text-emerald-800">{formatRupiah(report.deposits.totalAmount)}</dd>
                <dd className="mt-1 text-xs text-neutral-600">Memakai harga yang dikunci saat setoran</dd>
              </div>

              <div className="rounded-2xl border border-purple-200/60 bg-purple-50/60 p-5">
                <dt className="flex items-center gap-2 text-sm font-semibold text-purple-950">
                  <CheckCircle2 className="h-5 w-5 text-purple-600" /> Penarikan Disetujui
                </dt>
                <dd className="mt-2 text-2xl font-bold text-purple-800">{formatRupiah(report.withdrawals.approved.totalAmount)}</dd>
                <dd className="mt-1 text-xs text-neutral-600">{report.withdrawals.approved.count} pengajuan disetujui</dd>
              </div>

              <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-5">
                <dt className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                  <Wallet className="h-5 w-5 text-amber-600" /> Sisa Saldo Seluruh Nasabah
                </dt>
                <dd className="mt-2 text-2xl font-bold text-amber-800">{formatRupiah(report.balances.totalBalance)}</dd>
                <dd className="mt-1 text-xs text-neutral-600">
                  {report.balances.nasabahCount} nasabah, per saat laporan dibuat (tidak terikat periode)
                </dd>
              </div>
            </dl>
          </section>

          {/* Rekap per kategori */}
          <section aria-labelledby="by-category" className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 id="by-category" className="text-lg font-bold text-neutral-900">Rekap per Jenis Sampah</h2>
            <p className="mb-4 text-xs text-neutral-500">
              Nilai dijumlahkan dari subtotal setoran, bukan dari harga hari ini.
            </p>

            {report.deposits.count === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Belum ada setoran pada periode ini"
                description="Ubah rentang tanggal atau tekan Reset untuk melihat seluruh data."
              />
            ) : (
              <CategoryTable report={report} />
            )}
          </section>

          {/* Penarikan */}
          <section aria-labelledby="withdrawals" className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 id="withdrawals" className="text-lg font-bold text-neutral-900">Rekap Penarikan Saldo</h2>
            <p className="mb-4 text-xs text-neutral-500">
              Penarikan yang sudah diproses dihitung menurut waktu diproses; yang menunggu menurut waktu diajukan.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Jumlah dan total nominal penarikan saldo per status</caption>
                <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Jumlah pengajuan</th>
                    <th scope="col" className="py-2 text-right font-semibold">Total nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <th scope="row" className="py-2.5 pr-4 font-medium text-emerald-700">
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Disetujui</span>
                    </th>
                    <td className="py-2.5 pr-4 text-right">{report.withdrawals.approved.count}</td>
                    <td className="py-2.5 text-right font-semibold">{formatRupiah(report.withdrawals.approved.totalAmount)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2.5 pr-4 font-medium text-amber-700">
                      <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Menunggu persetujuan</span>
                    </th>
                    <td className="py-2.5 pr-4 text-right">{report.withdrawals.pending.count}</td>
                    <td className="py-2.5 text-right font-semibold">{formatRupiah(report.withdrawals.pending.totalAmount)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2.5 pr-4 font-medium text-red-700">
                      <span className="inline-flex items-center gap-1.5"><XCircle className="h-4 w-4" /> Ditolak</span>
                    </th>
                    <td className="py-2.5 pr-4 text-right">{report.withdrawals.rejected.count}</td>
                    <td className="py-2.5 text-right font-semibold">{formatRupiah(report.withdrawals.rejected.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-neutral-500">
            Laporan dibuat {dateTimeFormatter.format(new Date(report.generatedAt))} WIB.
          </p>
        </>
      )}
    </div>
  );
}

function CategoryTable({ report }: { report: AdminReport }) {
  const totalWeight = report.categories.reduce((sum, row) => sum + row.totalWeightKg, 0);
  const totalValue = report.categories.reduce((sum, row) => sum + row.totalValue, 0);
  const totalItems = report.categories.reduce((sum, row) => sum + row.itemCount, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Rekap setoran per jenis sampah: jumlah item, total berat, proporsi, dan total nilai</caption>
        <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th scope="col" className="py-2 pr-4 font-semibold">Jenis sampah</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">Jumlah item</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">Total berat (kg)</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Proporsi berat</th>
            <th scope="col" className="py-2 text-right font-semibold">Total nilai</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {report.categories.map((row) => {
            const share = totalWeight > 0 ? (row.totalWeightKg / totalWeight) * 100 : 0;
            return (
              <tr key={row.categoryId} className={row.itemCount === 0 ? "text-neutral-400" : ""}>
                <th scope="row" className="py-2.5 pr-4 font-medium">
                  <span className="text-neutral-900">{row.name}</span>
                  <span className="ml-2 font-mono text-[11px] font-normal text-neutral-400">{row.code}</span>
                  {!row.isActive && (
                    <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                      Nonaktif
                    </span>
                  )}
                </th>
                <td className="py-2.5 pr-4 text-right">{row.itemCount}</td>
                <td className="py-2.5 pr-4 text-right">{formatKg(row.totalWeightKg)}</td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    {/* Batang hanya hiasan; angka persen di sebelahnya yang dibaca pembaca layar */}
                    <div aria-hidden="true" className="h-2 w-24 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, share)}%` }} />
                    </div>
                    <span className="text-xs tabular-nums">{formatPercent(share)}</span>
                  </div>
                </td>
                <td className="py-2.5 text-right font-semibold">{formatRupiah(row.totalValue)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-neutral-200 font-bold text-neutral-900">
          <tr>
            <th scope="row" className="py-3 pr-4">Total</th>
            <td className="py-3 pr-4 text-right">{totalItems}</td>
            <td className="py-3 pr-4 text-right">{formatKg(totalWeight)}</td>
            <td className="py-3 pr-4 text-xs font-normal">100%</td>
            <td className="py-3 text-right">{formatRupiah(totalValue)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
