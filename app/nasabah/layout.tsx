import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function NasabahLayout({ children }: { children: ReactNode }) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (session.role !== "nasabah") redirect("/forbidden");

    return (
        <DashboardShell role="nasabah" userName={session.name} userEmail={session.email}>
            {children}
        </DashboardShell>
    );
}