import { PackagePlus } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Catat Setoran" };

export default function PetugasDepositsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Layanan Penimbangan & Setoran Sampah</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Area kerja petugas untuk mencatat setoran sampah nasabah.
        </p>
      </div>
      <EmptyState
        icon={PackagePlus}
        title="Form setoran segera hadir"
        description="Form pencatatan setoran multi-sampah dibangun oleh Orang 3 pada Minggu 2."
      />
    </div>
  );
}