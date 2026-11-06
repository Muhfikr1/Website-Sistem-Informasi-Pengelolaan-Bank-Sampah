import { FolderKanban } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Jenis & Harga Sampah" };

export default function AdminWasteCategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Jenis & Harga Sampah</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kelola jenis sampah, harga per kg, dan foto katalog publik.
        </p>
      </div>
      <EmptyState
        icon={FolderKanban}
        title="Modul CRUD segera hadir"
        description="Tabel jenis sampah, form ubah harga, dan upload foto akan dibangun pada Minggu 2."
      />
    </div>
  );
}