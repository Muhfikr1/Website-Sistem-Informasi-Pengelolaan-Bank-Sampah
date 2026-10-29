import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase, SUPABASE_PRIVATE_BUCKET, uploadPrivateDocument } from "@/lib/supabase";
import { checkRateLimit, getClientIp, createRateLimitResponse } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(100, "Nama maksimal 100 karakter."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid.")
    .min(1, "Email wajib diisi."),
  password: z
    .string()
    .min(6, "Kata sandi minimal terdiri dari 6 karakter."),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (sesuai CHECK constraint size_bytes)

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  // 1. Rate Limiting (Maks 10 percobaan per 1 menit per IP)
  const rateLimitResult = checkRateLimit(`register:${clientIp}`, {
    limit: 10,
    windowMs: 60 * 1000,
  });

  if (!rateLimitResult.success) {
    logger.warn(
      { ip: clientIp, remaining: rateLimitResult.remaining },
      "Rate limit exceeded pada endpoint register"
    );
    return createRateLimitResponse(rateLimitResult.reset);
  }

  let uploadedStoragePath: string | null = null;

  try {
    const formData = await request.formData();
    const rawData = {
      name: formData.get("name")?.toString(),
      email: formData.get("email")?.toString(),
      password: formData.get("password")?.toString(),
      phone: formData.get("phone")?.toString() || null,
      address: formData.get("address")?.toString() || null,
    };

    // 2. Validasi Skema Zod (Validasi Lapis 2)
    const validationResult = registerBodySchema.safeParse(rawData);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]?.message || "Data input tidak valid.";
      logger.warn({ ip: clientIp, errors: validationResult.error.issues }, "Validasi data register gagal");
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, password, phone, address } = validationResult.data;
    const documentFile = formData.get("document");

    // Validasi berkas dokumen
    if (!(documentFile instanceof File) || documentFile.size === 0) {
      return NextResponse.json(
        { error: "Berkas dokumen pendaftaran / KTP wajib diunggah." },
        { status: 400 }
      );
    }

    if (documentFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran berkas dokumen melebihi batas maksimal 5 MB." },
        { status: 400 }
      );
    }

    logger.info({ ip: clientIp, email }, "Memproses pendaftaran nasabah baru");

    // 3. Cek keunikan email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      logger.warn({ ip: clientIp, email }, "Upaya pendaftaran dengan email yang sudah ada");
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan gunakan email lain." },
        { status: 409 }
      );
    }

    // Hash kata sandi
    const password_hash = await bcrypt.hash(password, 10);

    // 4. Upload berkas ke Supabase Private Bucket
    const fileBytes = await documentFile.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);
    const mimeType = documentFile.type || "application/octet-stream";

    const uploadResult = await uploadPrivateDocument(
      fileBuffer,
      documentFile.name,
      mimeType
    );
    uploadedStoragePath = uploadResult.path;

    // 5. Database Transaction: Simpan data User nasabah & metadata berkas di tabel user_documents
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password_hash,
          phone,
          address,
          role: "nasabah",
          balance: 0.0,
        },
      });

      const document = await tx.userDocument.create({
        data: {
          user_id: user.id,
          document_type: "BERKAS_PENDAFTARAN",
          original_name: documentFile.name,
          storage_bucket: SUPABASE_PRIVATE_BUCKET,
          storage_object_key: uploadedStoragePath as string,
          mime_type: mimeType,
          size_bytes: documentFile.size,
        },
      });

      return { user, document };
    });

    logger.info(
      { userId: result.user.id, email: result.user.email, documentId: result.document.id },
      "Registrasi nasabah dan penyimpanan dokumen privat berhasil"
    );

    return NextResponse.json(
      {
        success: true,
        message: "Pendaftaran nasabah berhasil dilakukan.",
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Rollback berkas Supabase jika transaksi database gagal
    if (uploadedStoragePath) {
      try {
        await supabase.storage
          .from(SUPABASE_PRIVATE_BUCKET)
          .remove([uploadedStoragePath]);
        logger.info({ path: uploadedStoragePath }, "Berkas Supabase di-rollback setelah error transaksi");
      } catch (cleanupErr) {
        logger.error({ cleanupErr, path: uploadedStoragePath }, "Gagal membersihkan berkas Supabase saat rollback");
      }
    }

    logger.error({ error, ip: clientIp }, "Error pada registrasi nasabah");
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server saat registrasi." },
      { status: 500 }
    );
  }
}
