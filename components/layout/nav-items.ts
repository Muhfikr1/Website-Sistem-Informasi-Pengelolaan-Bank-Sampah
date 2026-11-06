import {
    Banknote,
    FolderKanban,
    BarChart3,
    Leaf,
    PackagePlus,
    UserCircle,
    Users,
    Wallet,
    type LucideIcon,
} from "lucide-react";

export type Role = "nasabah" | "petugas" | "admin";

export interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
    admin: [
        { label: "Jenis & Harga Sampah", href: "/admin/waste-categories", icon: FolderKanban },
        { label: "Kelola Nasabah", href: "/admin/users", icon: Users },
        { label: "Penarikan Saldo", href: "/admin/withdrawals", icon: Banknote },
        { label: "Laporan Rekap", href: "/admin/reports", icon: BarChart3 },
    ],
    petugas: [
        { label: "Catat Setoran", href: "/petugas/deposits", icon: PackagePlus },
        { label: "Profil & CV", href: "/petugas/profile", icon: UserCircle },
    ],
    nasabah: [
        { label: "Dashboard", href: "/nasabah/dashboard", icon: Leaf },
        { label: "Penarikan Saldo", href: "/nasabah/withdrawals", icon: Wallet },
    ],
};

export const ROLE_META: Record<Role, { title: string; accent: string; accentSoft: string }> = {
    admin: { title: "Panel Administrator", accent: "bg-slate-900", accentSoft: "bg-slate-100 text-slate-900" },
    petugas: { title: "Portal Petugas", accent: "bg-teal-600", accentSoft: "bg-teal-50 text-teal-800" },
    nasabah: { title: "Portal Nasabah", accent: "bg-emerald-600", accentSoft: "bg-emerald-50 text-emerald-800" },
};