import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ShieldAlert, ArrowLeft, Home, UserCheck } from "lucide-react";

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; role?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const currentRole = session?.role || params.role || "TIDAK DIKETAHUI";
  const reason =
    params.reason ||
    "Role akun Anda tidak memiliki hak akses (insufficient privileges) untuk rute yang dituju.";

  let dashboardUrl = "/login";
  if (session?.role === "nasabah") dashboardUrl = "/nasabah/dashboard";
  else if (session?.role === "petugas") dashboardUrl = "/petugas/deposits";
  else if (session?.role === "admin") dashboardUrl = "/admin/waste-categories";

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5 text-red-500 shadow-inner">
            <ShieldAlert className="w-9 h-9 stroke-[2.2]" />
          </div>

          <span className="text-xs font-mono font-semibold tracking-widest text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 uppercase mb-3">
            Error Code: 403
          </span>

          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            403 FORBIDDEN - AKSES DITOLAK
          </h1>

          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            {reason}
          </p>

          {/* User Role Card */}
          <div className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-neutral-300 text-xs">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Role Pengguna Aktif:</span>
            </div>
            <span className="font-mono text-xs font-bold uppercase px-2.5 py-1 rounded-md bg-neutral-700 text-emerald-300 border border-emerald-500/30">
              {currentRole}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3">
            <Link
              href={dashboardUrl}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-950/40"
            >
              <Home className="w-4 h-4" />
              <span>Kembali ke Beranda / Dashboard</span>
            </Link>

            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium text-xs transition-all border border-neutral-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ganti Akun / Halaman Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
