import { formatFileSize } from "@/lib/upload-rules";

/**
 * Aturan unggah foto katalog sampah (publik).
 * Dipakai bersama oleh form admin (Lapis 1) dan API (Lapis 2).
 */
export const MAX_CATALOG_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_CATALOG_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type CatalogImageMime = (typeof ALLOWED_CATALOG_IMAGE_MIME)[number];

/** Nilai atribut `accept` untuk <input type="file">. */
export const CATALOG_IMAGE_ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

/** Validasi ukuran dan tipe yang dilaporkan browser. Mengembalikan pesan error, atau null jika valid. */
export function validateCatalogImageMeta(file: { size: number; type: string }): string | null {
    if (file.size <= 0) {
        return "Berkas gambar kosong. Pilih gambar yang valid.";
    }
    if (file.size > MAX_CATALOG_IMAGE_BYTES) {
        return `Ukuran gambar ${formatFileSize(file.size)} melebihi batas maksimal 2 MB.`;
    }
    if (!(ALLOWED_CATALOG_IMAGE_MIME as readonly string[]).includes(file.type)) {
        return "Format gambar harus JPG, PNG, atau WebP.";
    }
    return null;
}

/** Mengenali format gambar dari isi aslinya (magic bytes), bukan dari nama atau header. */
export function detectImageMimeFromBytes(bytes: Uint8Array): CatalogImageMime | null {
    const startsWith = (signature: number[], offset = 0) =>
        bytes.length >= offset + signature.length &&
        signature.every((value, index) => bytes[offset + index] === value);

    if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    // WebP: "RIFF" + 4 byte ukuran + "WEBP"
    if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
    return null;
}