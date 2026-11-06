import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (session.role !== "admin") redirect("/forbidden");

    return (
        <DashboardShell role="admin" userName={session.name} userEmail={session.email}>
            {children}
        </DashboardShell>
    );
}