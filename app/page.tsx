import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Recycle, ArrowRight, ShieldCheck, UserPlus, LogIn, Scale } from "lucide-react";

export default async function Home() {
  const session = await getSession();

  let targetDashboard = "/login";
  if (session?.role === "nasabah") targetDashboard = "/nasabah/dashboard";
  else if (session?.role === "petugas") targetDashboard = "/petugas/deposits";
  else if (session?.role === "admin") targetDashboard = "/admin/waste-categories";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-white to-neutral-50 text-neutral-900 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-emerald-100/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <Recycle className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-emerald-950 block leading-tight">
                Bank Sampah Digital
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">
                Sistem Informasi Pengelolaan Terpadu
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href={targetDashboard}
                className="flex items-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm"
              >
                <span>Buka Dashboard ({session.role})</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-neutral-700 hover:text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk</span>
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm shadow-emerald-600/20"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Daftar Nasabah</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center text-center py-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-100/70 text-emerald-800 border border-emerald-200/80 mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Sistem Informasi Terintegrasi Bank Sampah</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-neutral-900 tracking-tight max-w-2xl leading-[1.15]">
          Ubah Sampah Menjadi Berkah & Nilai Ekonomi Nyata
        </h1>

        <p className="mt-5 text-base sm:text-lg text-neutral-600 max-w-xl leading-relaxed">
          Platform digital pengelolaan bank sampah dengan pembekuan harga setoran otomatis,
          proteksi berkas dokumen privat, dan penarikan saldo transparan.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/25"
          >
            <span>Daftar Nasabah Baru</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-sm transition-all border border-neutral-300 shadow-sm"
          >
            <span>Masuk ke Akun Anda</span>
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Recycle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-neutral-900 mb-1 text-base">Portal Nasabah</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Cek saldo riil, histori mutasi transaksi kredit & debit, dan upload berkas dokumen pendaftaran dengan privasi terjamin.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-neutral-900 mb-1 text-base">Portal Petugas</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Input penimbangan sampah dengan presisi desimal 2 angka di belakang koma dan pencatatan snapshot harga secara real-time.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-neutral-900 mb-1 text-base">Portal Administrator</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Manajemen kategori dan harga sampah, approval penarikan saldo, serta kontrol keamanan berkas berbasis RBAC 3 Peran.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        &copy; {new Date().getFullYear()} Bank Sampah Digital. Seluruh hak cipta dilindungi undang-undang.
      </footer>
    </div>
  );
}
