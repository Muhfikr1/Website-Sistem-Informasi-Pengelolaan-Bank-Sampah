import Link from "next/link";
import { ArrowRight, LogIn, Recycle, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site-config";

const ANCHORS = [
    { label: "Jenis & Harga", href: "/#katalog" },
    { label: "Prosedur", href: "/#prosedur" },
    { label: "Jadwal", href: "/#jadwal" },
    { label: "Lokasi", href: "/#lokasi" },
];

const DASHBOARD_BY_ROLE = {
    nasabah: "/nasabah/dashboard",
    petugas: "/petugas/deposits",
    admin: "/admin/waste-categories",
} as const;

/** Navbar halaman publik. Tombol kanan berubah tergantung status login. */
export default async function PublicNavbar() {
    const session = await getSession();

    return (
        <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/85 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-3" aria-label={`${siteConfig.name} - Beranda`}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                        <Recycle className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="hidden sm:block">
                        <span className="block text-base font-bold leading-tight text-emerald-950">{siteConfig.name}</span>
                        <span className="text-[11px] font-medium text-emerald-700">{siteConfig.tagline}</span>
                    </span>
                </Link>

                <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
                    {ANCHORS.map((a) => (
                        <Link
                            key={a.href}
                            href={a.href}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                            {a.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    {session ? (
                        <Link
                            href={DASHBOARD_BY_ROLE[session.role]}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                            <span>Buka Dashboard</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                                <LogIn className="h-4 w-4" aria-hidden="true" />
                                <span>Masuk</span>
                            </Link>
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                            >
                                <UserPlus className="h-4 w-4" aria-hidden="true" />
                                <span>Daftar</span>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}