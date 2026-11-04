import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase, SUPABASE_PRIVATE_BUCKET, uploadPrivateDocument } from "@/lib/supabase";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/ratelimit";
import { apiLogger, startTimer } from "@/lib/logger";
import { detectMimeFromBytes, validateDocumentMeta } from "@/lib/upload-rules";

// Validasi Lapis 2: bentuk, ukuran, dan tipe berkas diperiksa ulang di server.
const cvFileSchema = z
  .instanceof(File, { message: "Berkas CV wajib diunggah." })
  .superRefine((file, ctx) => {
    const message = validateDocumentMeta(file);
    if (message) ctx.addIssue({ code: "custom", message });
  });

export async function POST(request: NextRequest) {
  const stop = startTimer();
  const ip = getClientIp(request);
  const log = apiLogger.child({ operation: "upload_cv", ip });

  // 1. Rate limiting (maks 10 percobaan per menit per IP)
  const rate = checkRateLimit(`cv-upload:${ip}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rate.success) {
    log.warn({ duration_ms: stop() }, "Rate limit terlampaui pada upload CV");
    return createRateLimitResponse(rate.reset);
  }

  // 2. Autentikasi dan otorisasi. Middleware tidak melindungi /api/*, jadi wajib dicek di sini.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Anda harus login terlebih dahulu." }, { status: 401 });
  }
  if (session.role !== "petugas") {
    log.warn({ userId: session.id, role: session.role }, "Upload CV ditolak: bukan petugas");
    return NextResponse.json({ error: "Hanya petugas yang boleh mengunggah CV." }, { status: 403 });
  }

  let uploadedKey: string | null = null;

  try {
    // 3. Baca dan validasi berkas
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Permintaan harus berupa multipart/form-data." },
        { status: 400 }
      );
    }

    const parsed = cvFileSchema.safeParse(formData.get("file"));
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Berkas tidak valid.";
      log.warn({ userId: session.id, message }, "Validasi berkas CV gagal");
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const file = parsed.data;

    // Cek isi asli berkas, bukan hanya MIME dari header yang bisa dipalsukan
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectMimeFromBytes(buffer);
    if (!detectedMime) {
      log.warn({ userId: session.id, declaredType: file.type }, "Isi berkas CV tidak sesuai format");
      return NextResponse.json(
        { error: "Isi berkas tidak sesuai format PDF, JPG, atau PNG." },
        { status: 400 }
      );
    }

    // 4. Unggah ke Supabase Private Bucket
    const uploaded = await uploadPrivateDocument(buffer, file.name, detectedMime);
    uploadedKey = uploaded.path;

    // 5. Simpan metadata. Satu petugas memegang satu CV aktif: CV lama diganti.
    const { document, previous } = await prisma.$transaction(async (tx) => {
      const previous = await tx.userDocument.findMany({
        where: { user_id: session.id, document_type: "CV" },
        select: { id: true, storage_object_key: true },
      });

      const document = await tx.userDocument.create({
        data: {
          user_id: session.id,
          document_type: "CV",
          original_name: file.name.slice(0, 200),
          storage_bucket: SUPABASE_PRIVATE_BUCKET,
          storage_object_key: uploaded.path,
          mime_type: detectedMime,
          size_bytes: file.size,
        },
      });

      if (previous.length > 0) {
        await tx.userDocument.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });
      }
      return { document, previous };
    });
    uploadedKey = null; // sudah tersimpan di database, tidak perlu di-rollback lagi

    // 6. Bersihkan berkas CV lama di storage. Gagal di sini tidak membatalkan unggahan.
    if (previous.length > 0) {
      try {
        const { error } = await supabase.storage
          .from(SUPABASE_PRIVATE_BUCKET)
          .remove(previous.map((p) => p.storage_object_key));
        if (error) log.warn({ err: error }, "Gagal menghapus CV lama dari storage");
      } catch (err) {
        log.warn({ err }, "Gagal menghapus CV lama dari storage");
      }
    }

    log.info(
      { userId: session.id, documentId: document.id, size_bytes: file.size, duration_ms: stop() },
      "CV petugas berhasil diunggah"
    );

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          original_name: document.original_name,
          size_bytes: document.size_bytes,
          created_at: document.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    // Rollback: hapus berkas yang sudah terunggah jika penyimpanan metadata gagal
    if (uploadedKey) {
      try {
        await supabase.storage.from(SUPABASE_PRIVATE_BUCKET).remove([uploadedKey]);
      } catch (cleanupErr) {
        log.error({ err: cleanupErr, path: uploadedKey }, "Gagal membersihkan berkas saat rollback");
      }
    }
    log.error({ userId: session.id, err, duration_ms: stop() }, "Error saat mengunggah CV petugas");
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server saat mengunggah CV." },
      { status: 500 }
    );
  }
}