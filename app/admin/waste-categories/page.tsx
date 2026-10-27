import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { Shield, ShieldAlert, FolderKanban, Users, Banknote } from "lucide-react";

export default async function AdminWasteCategoriesPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-neutral-900 block leading-tight">
                Bank Sampah
              </span>
              <span className="text-xs text-neutral-500">Panel Administrator</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-neutral-800">
                {session?.name || "Administrator"}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {session?.email}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300 mb-3">
                <Shield className="w-3.5 h-3.5" />
                <span>Hak Akses Penuh: Role {session?.role}</span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Manajemen Kategori Sampah & Sistem
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Kelola master data kategori sampah, harga per kg, persetujuan penarikan saldo, dan akses berkas privat.
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              ID: {session?.id.slice(0, 8)}...
            </span>
          </div>

          {/* Module Placeholder Info */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <FolderKanban className="w-5 h-5 text-slate-700" />
                <h3 className="font-semibold text-sm text-slate-900">
                  Kategori Sampah (Orang 2)
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Pengaturan harga terkini per kg <code>DECIMAL(15,2)</code> dan katalog foto publik di <code>/public/storage/catalog/</code>.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
              <div className="flex items-center gap-3 mb-2">
                <Banknote className="w-5 h-5 text-emerald-700" />
                <h3 className="font-semibold text-sm text-emerald-950">
                  Approval Penarikan
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Validasi dan persetujuan penarikan saldo nasabah dengan transaksi database dan pencatatan mutasi debit.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200/60">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-amber-700" />
                <h3 className="font-semibold text-sm text-amber-950">
                  Verifikasi Berkas Nasabah
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Akses seluruh berkas KTP & pendaftaran privat nasabah via endpoint <code>/documents/[id]/view</code>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
