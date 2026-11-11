import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/ui-format";
import EmptyState from "@/components/ui/EmptyState";
import { PackagePlus } from "lucide-react";

export const metadata = { title: "Catat Setoran" };
export const dynamic = "force-dynamic";

export default async function PetugasDepositsPage() {
  const session = await getSession();
  const deposits = await prisma.deposit.findMany({
    where: { petugas_id: session!.id },
    orderBy: { deposit_date: "desc" },
    take: 20,
    include: { nasabah: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Layanan Penimbangan & Setoran Sampah</h1>
          <p className="mt-1 text-sm text-neutral-500">20 setoran terakhir yang Anda catat.</p>
        </div>
        <Link
          href="/petugas/deposits/create"
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Catat Setoran
        </Link>
      </div>

      {deposits.length === 0 ? (
        <EmptyState
          title="Belum ada setoran"
          description="Setoran yang Anda catat akan muncul di sini."
          icon={PackagePlus}
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
          {deposits.map((d) => (
            <li key={d.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{d.nasabah.name}</p>
                <p className="text-gray-500">
                  {d.transaction_code} · {d.total_weight_kg.toString()} kg
                </p>
              </div>
              <p className="font-semibold">{formatRupiah(Number(d.total_amount))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}