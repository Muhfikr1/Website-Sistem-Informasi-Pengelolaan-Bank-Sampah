"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, Recycle, X } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import PushToggle from "@/components/PushToggle";
import Sidebar from "./Sidebar";
import { ROLE_META, type Role } from "./nav-items";

interface DashboardShellProps {
    role: Role;
    userName: string;
    userEmail: string;
    children: ReactNode;
}

/**
 * Kerangka dashboard untuk 3 role: sidebar (desktop) / drawer (HP) + topbar + konten.
 * Semua halaman di /admin, /petugas, /nasabah otomatis memakai ini lewat layout.tsx.
 */
export default function DashboardShell({
    role,
    userName,
    userEmail,
    children,
}: DashboardShellProps) {
    const [open, setOpen] = useState(false);
    const meta = ROLE_META[role];

    // Tutup drawer dengan tombol Escape (aksesibilitas keyboard)
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open]);

    const brand = (
        <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${meta.accent}`}>
                <Recycle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
                <span className="block text-base font-bold leading-tight text-neutral-900">Bank Sampah</span>
                <span className="text-xs text-neutral-500">{meta.title}</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900">
            {/* Sidebar desktop */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-neutral-200 bg-white p-4 lg:flex">
                <div className="mb-6 px-2 pt-1">{brand}</div>
                <Sidebar role={role} />
            </aside>

            {/* Drawer HP */}
            {open && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label="Tutup menu"
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 bg-black/40"
                    />
                    <aside
                        id="mobile-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menu navigasi"
                        className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 shadow-xl"
                    >
                        <div className="mb-6 flex items-center justify-between px-2 pt-1">
                            {brand}
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Tutup menu"
                                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                            >
                                <X className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </div>
                        <Sidebar role={role} onNavigate={() => setOpen(false)} />
                    </aside>
                </div>
            )}

            {/* Area utama */}
            <div className="lg:pl-64">
                <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:px-6">
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-label="Buka menu"
                        aria-expanded={open}
                        aria-controls="mobile-drawer"
                        className="rounded-lg p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
                    >
                        <Menu className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="hidden lg:block" />
                    <div className="flex items-center gap-4">
                        <div className="hidden flex-col text-right sm:flex">
                            <span className="text-sm font-semibold text-neutral-800">{userName}</span>
                            <span className="text-xs text-neutral-500">{userEmail}</span>
                        </div>
                        {role === "nasabah" && <PushToggle />}
                        <LogoutButton />
                    </div>
                </header>

                <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                    {children}
                </main>
            </div>
        </div>
    );
}