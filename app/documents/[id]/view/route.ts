import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase, PRIVATE_DOCUMENTS_BUCKET } from "@/lib/supabase";
import fs from "fs/promises";
import path from "path";

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
  try {
    // 1. Validasi sesi login pengguna
    const session = await getSession();
    if (!session) {
      return createForbiddenHtmlResponse(
        "403 FORBIDDEN - ANDA HARUS LOGIN",
        "Akses dokumen privat ditolak. Anda wajib masuk terlebih dahulu untuk mengakses dokumen pribadi.",
        403
      );
    }

    const { id } = await params;

    // 2. Ambil metadata dokumen dari database
    const document = await prisma.userDocument.findUnique({
      where: { id: String(id) },
      include: { user: true },
    });

    if (!document) {
      return new NextResponse(
        JSON.stringify({ error: "Dokumen tidak ditemukan." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. VALIDASI OTORISASI WAJIB:
    // Hanya pemilik sah dokumen (session.id === document.user_id) ATAU role 'admin'
    const isOwner = session.id === document.user_id;
    const isAdmin = session.role === "admin";

    if (!isOwner && !isAdmin) {
      return createForbiddenHtmlResponse(
        "403 FORBIDDEN - AKSES DOKUMEN PRIVAT DITOLAK",
        "Pengguna tanpa hak tidak diizinkan membuka CV, berkas pendaftaran, atau dokumen pribadi milik pengguna lain.",
        403
      );
    }

    // 4. Unduh berkas dari Supabase Storage Bucket 'private-documents'
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(PRIVATE_DOCUMENTS_BUCKET)
      .download(document.private_file_path);

    if (fileBlob) {
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

    // Fallback: Jika berkas pernah diunggah ke storage lokal sebelum integrasi Supabase
    if (downloadError) {
      const fileName = path.basename(document.private_file_path);
      const localPath = path.join(process.cwd(), "storage", "private", "documents", fileName);

      try {
        await fs.access(localPath);
        const localBuffer = await fs.readFile(localPath);
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
        console.error("Supabase Storage error:", downloadError);
        return new NextResponse(
          JSON.stringify({
            error: "Berkas tidak ditemukan di Supabase Storage maupun penyimpanan lokal.",
            details: downloadError.message,
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new NextResponse(
      JSON.stringify({ error: "Gagal memproses berkas dokumen." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error saat mengakses dokumen privat:", error);
    return new NextResponse(
      JSON.stringify({ error: "Terjadi kesalahan internal pada server saat membuka dokumen." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
