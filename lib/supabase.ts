import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function getValidSupabaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl) return "https://placeholder-project.supabase.co";
  try {
    const parsed = new URL(envUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return envUrl;
    }
  } catch {
    // URL mengandung karakter tidak valid seperti [YOUR-PROJECT-REF]
  }
  return "https://placeholder-project.supabase.co";
}

const supabaseUrl = getValidSupabaseUrl();

// Server-side Supabase client menggunakan SUPABASE_SERVICE_ROLE_KEY untuk bypass RLS pada storage privat
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const SUPABASE_PUBLIC_BUCKET =
  process.env.SUPABASE_PUBLIC_BUCKET || "catalog";
export const SUPABASE_PRIVATE_BUCKET =
  process.env.SUPABASE_PRIVATE_BUCKET || "private-documents";

// Kompatibilitas mundur
export const PRIVATE_DOCUMENTS_BUCKET = SUPABASE_PRIVATE_BUCKET;

/**
 * Mengunggah berkas privat (KTP, pendaftaran, CV) ke private bucket Supabase Storage
 */
export async function uploadPrivateDocument(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string
): Promise<{ path: string }> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storageObjectKey = `${Date.now()}_${randomUUID()}_${sanitized}`;

  const { data, error } = await supabase.storage
    .from(SUPABASE_PRIVATE_BUCKET)
    .upload(storageObjectKey, fileBuffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal mengunggah berkas ke Supabase Private Bucket: ${error.message}`);
  }

  return { path: data?.path || storageObjectKey };
}

/**
 * Membuat Signed URL berbatas waktu untuk dokumen privat Supabase Storage
 */
export async function createPrivateDocumentSignedUrl(
  objectKey: string,
  expiresInSeconds: number = 300 // default 5 menit
): Promise<{ signedUrl: string | null; error: Error | null }> {
  if (!objectKey) {
    return { signedUrl: null, error: null };
  }

  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_PRIVATE_BUCKET)
      .createSignedUrl(objectKey, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return { signedUrl: null, error: error ? new Error(error.message) : null };
    }

    let finalUrl = data.signedUrl;
    if (finalUrl.startsWith("/")) {
      const baseUrl = supabaseUrl.replace(/\/+$/, "");
      finalUrl = `${baseUrl}${finalUrl}`;
    }

    return { signedUrl: finalUrl, error: null };
  } catch (err: unknown) {
    return {
      signedUrl: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Mengunggah foto katalog sampah publik ke catalog bucket Supabase Storage
 */
export async function uploadPublicCatalogImage(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string
): Promise<{ publicUrl: string; path: string }> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storageObjectKey = `catalog_${Date.now()}_${randomUUID()}_${sanitized}`;

  const { data, error } = await supabase.storage
    .from(SUPABASE_PUBLIC_BUCKET)
    .upload(storageObjectKey, fileBuffer, {
      contentType: mimeType || "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal mengunggah gambar ke Supabase Public Bucket: ${error.message}`);
  }

  const uploadedPath = data?.path || storageObjectKey;
  const { data: publicUrlData } = supabase.storage
    .from(SUPABASE_PUBLIC_BUCKET)
    .getPublicUrl(uploadedPath);

  return {
    publicUrl: publicUrlData.publicUrl,
    path: uploadedPath,
  };
}
