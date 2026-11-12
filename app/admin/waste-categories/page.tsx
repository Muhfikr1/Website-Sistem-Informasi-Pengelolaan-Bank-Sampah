import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";
import ErrorAlert from "@/components/ui/ErrorAlert";
import WasteCategoryManager from "@/components/admin/WasteCategoryManager";
import type { WasteCategoryRow } from "@/components/admin/types";

export const metadata = { title: "Jenis & Harga Sampah" };

// Data harus selalu terbaru setelah admin mengubah harga
export const dynamic = "force-dynamic";

async function loadCategories(): Promise<{ items: WasteCategoryRow[]; failed: boolean }> {
  try {
    const rows = await prisma.wasteCategory.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { deposit_items: true } } },
    });
    return {
      failed: false,
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        unit: row.unit,
        price: row.current_price_per_kg.toNumber(),
        imageUrl: row.public_image_url,
        isActive: row.is_active,
        usedCount: row._count.deposit_items,
      })),
    };
  } catch (error) {
    apiLogger.error({ error, operation: "admin.waste_categories.load" }, "Gagal memuat jenis sampah");
    return { items: [], failed: true };
  }
}

export default async function AdminWasteCategoriesPage() {
  const { items, failed } = await loadCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Jenis & Harga Sampah</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kelola jenis sampah, harga per kg, dan foto katalog publik. Perubahan harga hanya berlaku
          untuk setoran berikutnya.
        </p>
      </div>

      {failed ? (
        <ErrorAlert
          title="Data gagal dimuat"
          message="Daftar jenis sampah belum bisa diambil. Muat ulang halaman beberapa saat lagi."
        />
      ) : (
        <WasteCategoryManager items={items} />
      )}
    </div>
  );
}