"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, ROLE_META, type Role } from "./nav-items";

interface SidebarProps {
    role: Role;
    /** Dipanggil saat link diklik (dipakai untuk menutup drawer di HP). */
    onNavigate?: () => void;
}

export default function Sidebar({ role, onNavigate }: SidebarProps) {
    const pathname = usePathname();
    const items = NAV_ITEMS[role];
    const meta = ROLE_META[role];

    return (
        <nav aria-label={`Menu ${meta.title}`} className="flex flex-col gap-1">
            {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active
                                ? `${meta.accentSoft} font-semibold`
                                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                            }`}
                    >
                        <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}