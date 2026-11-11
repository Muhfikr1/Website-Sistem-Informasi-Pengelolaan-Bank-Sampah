import { prisma } from "@/lib/prisma";
import { DepositForm } from "@/app/petugas/deposits/create/DepositForm";

export const dynamic = "force-dynamic";

export default async function CreateDepositPage() {
  const [nasabah, categories] = await Promise.all([
    prisma.user.findMany({
      where: { role: "nasabah" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.wasteCategory.findMany({
      where: { is_active: true },
      select: { id: true, code: true, name: true, current_price_per_kg: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Catat Setoran</h1>
        <p className="text-sm text-gray-500">Pilih nasabah, lalu isi berat tiap jenis sampah.</p>
      </div>
      <DepositForm
        nasabah={nasabah}
        // Decimal diubah ke angka HANYA untuk tampilan estimasi. Server menghitung ulang sendiri.
        categories={categories.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          pricePerKg: Number(c.current_price_per_kg),
        }))}
      />
    </div>
  );
}
