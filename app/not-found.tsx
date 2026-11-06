import Link from "next/link";
import { Compass } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export default function NotFound() {
    return (
        <main id="main-content" className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
            <div className="w-full max-w-md">
                <EmptyState
                    icon={Compass}
                    title="Halaman tidak ditemukan"
                    description="Alamat yang Anda tuju belum tersedia atau sudah dipindahkan."
                    action={
                        <Link
                            href="/"
                            className="inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                            Kembali ke Beranda
                        </Link>
                    }
                />
            </div>
        </main>
    );
}