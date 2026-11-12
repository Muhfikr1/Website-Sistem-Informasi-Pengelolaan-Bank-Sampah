import type { Logger } from "pino";
import { supabase, SUPABASE_PUBLIC_BUCKET } from "@/lib/supabase";

/**
 * Mengambil nama objek (key) di bucket publik dari URL publiknya.
 * Mengembalikan null jika URL bukan milik bucket katalog kita.
 */
export function extractCatalogObjectKey(publicUrl: string | null | undefined): string | null {
    if (!publicUrl) return null;
    const marker = `/storage/v1/object/public/${SUPABASE_PUBLIC_BUCKET}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return null;
    const raw = publicUrl.slice(index + marker.length).split("?")[0];
    try {
        return decodeURIComponent(raw) || null;
    } catch {
        return null;
    }
}

/** Menghapus satu objek dari bucket katalog. Gagal hanya dicatat, tidak dilempar. */
export async function removeCatalogObject(key: string | null, log: Logger): Promise<void> {
    if (!key) return;
    try {
        const { error } = await supabase.storage.from(SUPABASE_PUBLIC_BUCKET).remove([key]);
        if (error) log.warn({ err: error, key }, "Gagal menghapus gambar katalog dari storage");
    } catch (err) {
        log.warn({ err, key }, "Gagal menghapus gambar katalog dari storage");
    }
}