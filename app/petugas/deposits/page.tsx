import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { PackagePlus, ShieldCheck, ClipboardList, Scale } from "lucide-react";

export default async function PetugasDepositsPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-neutral-900 block leading-tight">
                Bank Sampah
              </span>
              <span className="text-xs text-neutral-500">Portal Petugas Lapangan</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-neutral-800">
                {session?.name || "Petugas"}
              </span>
              <span className="text-xs text-teal-600 font-medium">
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Terautentikasi: Role {session?.role}</span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Layanan Penimbangan & Setoran Sampah
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Area kerja petugas untuk menginput setoran sampah nasabah dan mencatat transaksi penimbangan.
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              ID: {session?.id.slice(0, 8)}...
            </span>
          </div>

          {/* Module Placeholder Info */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-teal-50/60 border border-teal-200/60">
              <div className="flex items-center gap-3 mb-2">
                <Scale className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-sm text-teal-950">
                  Input Penimbangan (Orang 3)
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Pilih nasabah, kategori sampah, bobot desimal (10,2), dan sistem otomatis membekukan harga snapshot.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-neutral-100/70 border border-neutral-200">
              <div className="flex items-center gap-3 mb-2">
                <ClipboardList className="w-5 h-5 text-neutral-700" />
                <h3 className="font-semibold text-sm text-neutral-900">
                  Riwayat Transaksi Harian
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                Daftar transaksi setoran yang telah diproses oleh petugas yang bersangkutan hari ini.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
