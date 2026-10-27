import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";
import {
  User,
  Wallet,
  Leaf,
  ShieldCheck,
  FileText,
  ExternalLink,
  Lock,
  Calendar,
  AlertTriangle,
} from "lucide-react";

export default async function NasabahDashboardPage() {
  const session = await getSession();

  const documents = session?.id
    ? await prisma.userDocument.findMany({
        where: { user_id: session.id },
        orderBy: { created_at: "desc" },
      })
    : [];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-neutral-900 block leading-tight">
                Bank Sampah
              </span>
              <span className="text-xs text-neutral-500">Portal Nasabah</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-neutral-800">
                {session?.name || "Nasabah"}
              </span>
              <span className="text-xs text-emerald-600 font-medium">
                {session?.email}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Terautentikasi: Role {session?.role}</span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Selamat Datang, {session?.name}!
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Dashboard nasabah untuk memantau saldo, riwayat setoran sampah, dan pengajuan penarikan dana.
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              ID: {session?.id.slice(0, 8)}...
            </span>
          </div>

          {/* Module Placeholders */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-sm text-emerald-950">
                  Saldo & Penarikan
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Menampilkan saldo riil, riwayat mutasi kredit/debit, dan form penarikan (Orang 2).
              </p>
            </div>

            <div className="p-5 rounded-xl bg-blue-50/60 border border-blue-200/60">
              <div className="flex items-center gap-3 mb-2">
                <Leaf className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-sm text-blue-950">
                  Riwayat Setoran Sampah
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Melihat rincian setoran dan snapshot harga sampah saat penyetoran (Orang 2).
              </p>
            </div>

            <div className="p-5 rounded-xl bg-purple-50/60 border border-purple-200/60">
              <div className="flex items-center gap-3 mb-2">
                <User className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-sm text-purple-950">
                  Profil & Dokumen Privat
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Akses dokumen privat melalui endpoint aman <code>/documents/[id]/view</code>.
              </p>
            </div>
          </div>
        </div>

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
      </main>
    </div>
  );
}
