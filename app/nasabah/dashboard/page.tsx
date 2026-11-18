import Link from "next/link";
import { Wallet, Leaf, Scale, ShieldCheck, FileText, ExternalLink, Lock, Calendar, AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/ui-format";
import { dashboardQuerySchema, toDateRange } from "@/lib/validation/history";
import { getDashboardSummary, getDepositHistory, getMutationHistory } from "@/lib/nasabah-queries";
import { DepositHistory, MutationHistory } from "./HistorySections";

export const metadata = { title: "Dashboard Nasabah" };
export const dynamic = "force-dynamic";

export default async function NasabahDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const query = dashboardQuerySchema.parse({
    from: first(raw.from),
    to: first(raw.to),
    dpage: first(raw.dpage),
    mpage: first(raw.mpage),
  });
  const { range, error: dateError } = toDateRange(query.from, query.to);
  const keep = dateError ? {} : { from: query.from, to: query.to };

  const userId = session!.id;
  const [summary, deposits, mutations, documents] = await Promise.all([
    getDashboardSummary(userId),
    getDepositHistory(userId, query.dpage, range),
    getMutationHistory(userId, query.mpage, range),
    prisma.userDocument.findMany({ where: { user_id: userId }, orderBy: { created_at: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      {/* Sambutan */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Terautentikasi: Role {session?.role}</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Selamat Datang, {session?.name}!</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pantau saldo, riwayat setoran sampah, dan pengajuan penarikan dana Anda.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <Wallet className="h-5 w-5 text-emerald-600" /> Saldo Aktif
            </div>
            <p className="text-2xl font-bold text-emerald-800">{formatRupiah(summary.balance)}</p>
            <p className="mt-1 text-xs text-neutral-600">
              Bisa ditarik: {formatRupiah(summary.effectiveBalance)}
              {summary.pendingWithdrawals > 0 && ` (menunggu persetujuan ${formatRupiah(summary.pendingWithdrawals)})`}
            </p>
            <Link href="/nasabah/withdrawals" className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">
              Ajukan penarikan →
            </Link>
          </div>

          <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-950">
              <Scale className="h-5 w-5 text-blue-600" /> Total Berat Sampah
            </div>
            <p className="text-2xl font-bold text-blue-800">
              {summary.totalWeightKg.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
            </p>
            <p className="mt-1 text-xs text-neutral-600">Dari {summary.depositCount} kali setoran</p>
          </div>

          <div className="rounded-xl border border-purple-200/60 bg-purple-50/60 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-950">
              <Leaf className="h-5 w-5 text-purple-600" /> Dokumen Pribadi
            </div>
            <p className="text-2xl font-bold text-purple-800">{documents.length}</p>
            <p className="mt-1 text-xs text-neutral-600">Berkas terproteksi milik Anda</p>
          </div>
        </div>
      </div>

      {/* Filter tanggal */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-neutral-600">Dari tanggal</label>
          <input id="from" name="from" type="date" defaultValue={query.from ?? ""} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-neutral-600">Sampai tanggal</label>
          <input id="to" name="to" type="date" defaultValue={query.to ?? ""} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Terapkan filter
        </button>
        <Link href="/nasabah/dashboard" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
          Reset
        </Link>
        {dateError && <p role="alert" className="w-full text-xs text-red-600">{dateError}</p>}
      </form>

      <DepositHistory data={deposits} keep={{ ...keep, mpage: mutations.page }} />
      <MutationHistory data={mutations} keep={{ ...keep, dpage: deposits.page }} />

        {/* Section: Dokumen Pribadi Terproteksi */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-neutral-900">
                  Daftar Berkas & Dokumen Pribadi Terproteksi
                </h2>
              </div>
              <p className="text-xs text-neutral-500">
                Hanya dapat dibuka oleh pemilik akun yang bersangkutan atau Administrator sistem.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-600">
              <span>Total Berkas:</span>
              <strong className="text-neutral-900">{documents.length}</strong>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="p-8 border border-dashed border-neutral-200 rounded-xl text-center text-neutral-500">
              <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
              <p className="text-sm font-medium">Belum ada dokumen yang terdaftar.</p>
              <p className="text-xs text-neutral-400 mt-1">
                Dokumen KTP atau berkas pendaftaran akan muncul di sini setelah Anda registrasi.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 hover:border-emerald-300 bg-neutral-50/50 hover:bg-emerald-50/20 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-neutral-900">
                          {doc.original_name}
                        </span>
                        <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {doc.document_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(doc.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span>•</span>
                        <span>{doc.mime_type}</span>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-neutral-400">
                          Doc ID: {doc.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/documents/${doc.id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <span>Lihat Berkas Saya</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Testing info box */}
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">Catatan Pengujian Keamanan Otorisasi (Hari 6-7):</strong>
              <p className="text-amber-800 leading-relaxed">
                Endpoint <code>/documents/[id]/view</code> menjamin bahwa jika link berkas ini dicoba dibuka oleh pengguna lain (Nasabah lain atau Petugas yang tidak sah), sistem secara ketat mengembalikan respons <strong>HTTP 403 Forbidden</strong> dengan halaman peringatan penolakan akses dokumen privat.
              </p>
            </div>
          </div>
        </div>
    </div>
  );
}