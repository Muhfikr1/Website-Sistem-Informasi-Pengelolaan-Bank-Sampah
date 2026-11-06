/**
 * Aturan unggah berkas pribadi (CV, KTP, berkas pendaftaran).
 * Konstanta dipakai bersama oleh form (Lapis 1) dan API (Lapis 2).
 * Lapis 3 ada di database: CHECK (size_bytes > 0 AND size_bytes <= 5242880).
 */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_DOCUMENT_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIME)[number];

/** Nilai atribut `accept` untuk <input type="file">. */
export const DOCUMENT_ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Validasi ukuran dan tipe yang dilaporkan browser. Mengembalikan pesan error, atau null jika valid. */
export function validateDocumentMeta(file: { size: number; type: string }): string | null {
    if (file.size <= 0) {
        return "Berkas kosong. Pilih berkas CV yang valid.";
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
        return `Ukuran berkas ${formatFileSize(file.size)} melebihi batas maksimal 5 MB.`;
    }
    if (!(ALLOWED_DOCUMENT_MIME as readonly string[]).includes(file.type)) {
        return "Format berkas harus PDF, JPG, atau PNG.";
    }
    return null;
}

/**
 * Mengenali tipe berkas dari isi aslinya (magic bytes), bukan dari nama atau
 * header yang bisa dipalsukan. Dipakai server sebelum berkas disimpan.
 */
export function detectMimeFromBytes(bytes: Uint8Array): AllowedDocumentMime | null {
    const startsWith = (signature: number[]) =>
        bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);

    if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
    if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    return null;
}