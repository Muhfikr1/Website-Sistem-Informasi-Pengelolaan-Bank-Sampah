import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function PetugasLayout({ children }: { children: ReactNode }) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (session.role !== "petugas") redirect("/forbidden");

    return (
        <DashboardShell role="petugas" userName={session.name} userEmail={session.email}>
            {children}
        </DashboardShell>
    );
}