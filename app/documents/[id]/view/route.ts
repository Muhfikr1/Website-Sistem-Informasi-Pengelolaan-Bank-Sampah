import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  supabase,
  SUPABASE_PRIVATE_BUCKET,
  createPrivateDocumentSignedUrl,
} from "@/lib/supabase";
import { checkRateLimit, getClientIp, createRateLimitResponse } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const paramsSchema = z.object({
  id: z.string().min(1, "ID dokumen wajib disertakan."),
});

function createForbiddenHtmlResponse(
  title: string,
  message: string,
  statusCode: number = 403
) {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #09090b;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background-color: #18181b;
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 16px;
      padding: 32px 28px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .badge {
      display: inline-block;
      background-color: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 4px 14px;
      border-radius: 9999px;
      margin-bottom: 18px;
      text-transform: uppercase;
      font-family: monospace;
    }
    h1 {
      font-size: 20px;
      font-weight: 900;
      color: #ffffff;
      margin: 0 0 14px 0;
      letter-spacing: -0.02em;
      line-height: 1.35;
    }
    p {
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .btn-group {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
    a.btn {
      display: inline-block;
      background-color: #059669;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
      padding: 10px 20px;
      border-radius: 10px;
      transition: background-color 0.2s;
    }
    a.btn:hover {
      background-color: #10b981;
    }
    a.btn-secondary {
      background-color: #27272a;
      color: #d4d4d8;
      border: 1px solid #3f3f46;
    }
    a.btn-secondary:hover {
      background-color: #3f3f46;
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">HTTP ${statusCode} FORBIDDEN</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="btn-group">
      <a href="/login" class="btn">Halaman Login</a>
      <a href="/" class="btn btn-secondary">Beranda Utama</a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = getClientIp(request);

  // 1. Rate Limiting (Maks 30 request per menit per IP)
  const rateLimitResult = checkRateLimit(`doc-view:${clientIp}`, {
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rateLimitResult.success) {
    logger.warn({ ip: clientIp }, "Rate limit exceeded pada akses dokumen privat");
    return createRateLimitResponse(rateLimitResult.reset);
  }

  try {
    // 2. Validasi Parameter ID menggunakan Zod (Validasi Lapis 2)
    const rawParams = await params;
    const parsedParams = paramsSchema.safeParse(rawParams);

    if (!parsedParams.success) {
      logger.warn({ ip: clientIp, errors: parsedParams.error.issues }, "ID Dokumen tidak valid");
      return new NextResponse(
        JSON.stringify({ error: "ID Dokumen tidak valid." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { id } = parsedParams.data;

    // 3. Validasi sesi login pengguna
    const session = await getSession();
    if (!session) {
      logger.warn({ ip: clientIp, docId: id }, "Akses dokumen ditolak: sesi login tidak ditemukan");
      return createForbiddenHtmlResponse(
        "403 FORBIDDEN - ANDA HARUS LOGIN",
        "Akses dokumen privat ditolak. Anda wajib masuk terlebih dahulu untuk mengakses dokumen pribadi.",
        403
      );
    }

    // 4. Ambil metadata dokumen dari database
    const document = await prisma.userDocument.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!document) {
      logger.warn({ ip: clientIp, docId: id, userId: session.id }, "Dokumen tidak ditemukan di database");
      return new NextResponse(
        JSON.stringify({ error: "Dokumen tidak ditemukan." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. VALIDASI OTORISASI KETAT (Validasi Hak Akses):
    // Hanya pemilik sah dokumen (session.id === document.user_id) ATAU role 'admin'
    const isOwner = session.id === document.user_id;
    const isAdmin = session.role === "admin";

    if (!isOwner && !isAdmin) {
      logger.warn(
        {
          ip: clientIp,
          userId: session.id,
          userRole: session.role,
          docId: document.id,
          docOwnerId: document.user_id,
        },
        "Akses dokumen privat ditolak: pengguna tidak berhak (403 Forbidden)"
      );
      return createForbiddenHtmlResponse(
        "403 FORBIDDEN - AKSES DOKUMEN PRIVAT DITOLAK",
        "Pengguna tanpa hak tidak diizinkan membuka CV, berkas pendaftaran, atau dokumen pribadi milik pengguna lain.",
        403
      );
    }

    logger.info(
      { userId: session.id, role: session.role, docId: document.id },
      "Otorisasi akses dokumen privat berhasil diverifikasi"
    );

    // Ambil storage key dengan fallback kompatibilitas ke private_file_path (v3.0)
    const docRecord = document as unknown as Record<string, unknown>;
    const storageKey =
      (typeof docRecord.storage_object_key === "string" ? docRecord.storage_object_key : null) ||
      (typeof docRecord.private_file_path === "string" ? docRecord.private_file_path : null) ||
      "";

    // 6. Akses Berkas: Buat Signed URL berbatas waktu dari Supabase Storage jika terhubung
    if (storageKey) {
      const { signedUrl, error: signedUrlError } = await createPrivateDocumentSignedUrl(
        storageKey,
        300 // berlaku 5 menit (300 detik)
      );

      if (signedUrl && !signedUrlError) {
        logger.info({ docId: document.id }, "Mengarahkan akses dokumen privat ke Signed URL Supabase");
        const destination = signedUrl.startsWith("http")
          ? signedUrl
          : new URL(signedUrl, request.url).toString();
        return NextResponse.redirect(new URL(destination), 307);
      }
    }

    // Fallback 1: Unduh berkas langsung dari Supabase Storage jika Signed URL gagal
    if (storageKey) {
      const bucket =
        typeof docRecord.storage_bucket === "string"
          ? docRecord.storage_bucket
          : SUPABASE_PRIVATE_BUCKET;
      try {
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(storageKey);

        if (fileBlob && !downloadError) {
          const fileBytes = await fileBlob.arrayBuffer();
          return new NextResponse(Buffer.from(fileBytes), {
            status: 200,
            headers: {
              "Content-Type": document.mime_type || fileBlob.type || "application/octet-stream",
              "Content-Disposition": `inline; filename="${encodeURIComponent(
                document.original_name
              )}"`,
              "Cache-Control": "private, no-cache, no-store, must-revalidate",
            },
          });
        }
      } catch {
        // Abaikan error download Supabase dan lanjutkan ke fallback storage lokal
      }
    }

    // Fallback 2: Ambil berkas dari penyimpanan lokal (kompatibilitas berkas v3.0)
    const fileName = path.basename(storageKey || document.original_name);
    const localPath = path.join(process.cwd(), "storage", "private", "documents", fileName);

    try {
      await fs.access(localPath);
      const localBuffer = await fs.readFile(localPath);
      logger.info({ docId: document.id, localPath }, "Dokumen berhasil dibuka dari penyimpanan lokal");
      return new NextResponse(localBuffer, {
        status: 200,
        headers: {
          "Content-Type": document.mime_type || "application/octet-stream",
          "Content-Disposition": `inline; filename="${encodeURIComponent(
            document.original_name
          )}"`,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    } catch {
      // File tidak ada di local storage
    }

    logger.error(
      { docId: document.id, storageKey },
      "Dokumen tidak ditemukan di Supabase Storage maupun penyimpanan lokal"
    );
    return new NextResponse(
      JSON.stringify({
        error: "Berkas tidak ditemukan di Supabase Storage maupun penyimpanan lokal.",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    logger.error({ error, ip: clientIp }, "Error saat mengakses dokumen privat");

    const err = error as { code?: string; message?: string; name?: string } | undefined;
    const isDbError =
      err?.code === "P1001" ||
      err?.message?.includes("Can't reach database server") ||
      err?.name === "PrismaClientInitializationError";

    const errorMessage = isDbError
      ? "Koneksi database PostgreSQL tidak dapat dihubungi. Pastikan DATABASE_URL pada file .env sudah diatur dengan benar."
      : "Terjadi kesalahan internal pada server saat membuka dokumen.";

    return new NextResponse(
      JSON.stringify({ error: errorMessage, details: err?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
