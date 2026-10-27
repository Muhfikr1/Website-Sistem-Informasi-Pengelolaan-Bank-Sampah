import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase, PRIVATE_DOCUMENTS_BUCKET } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  let uploadedStoragePath: string | null = null;

  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString().trim();
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const password = formData.get("password")?.toString();
    const phone = formData.get("phone")?.toString().trim() || null;
    const address = formData.get("address")?.toString().trim() || null;
    const documentFile = formData.get("document");

    // Validasi field wajib
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Kata sandi minimal terdiri dari 6 karakter." },
        { status: 400 }
      );
    }

    if (!(documentFile instanceof File) || documentFile.size === 0) {
      return NextResponse.json(
        { error: "Berkas dokumen pendaftaran / KTP wajib diunggah." },
        { status: 400 }
      );
    }

    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan gunakan email lain." },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // 1. Persiapkan nama file unik & buffer untuk Supabase Storage
    const sanitizedOriginalName = documentFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}_${randomUUID()}_${sanitizedOriginalName}`;
    const storageFilePath = uniqueFileName;

    const fileBytes = await documentFile.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);

    // 2. Upload langsung ke Supabase Storage bucket 'private-documents'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PRIVATE_DOCUMENTS_BUCKET)
      .upload(storageFilePath, fileBuffer, {
        contentType: documentFile.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Gagal upload ke Supabase Storage:", uploadError);
      return NextResponse.json(
        {
          error: `Gagal mengunggah berkas ke Supabase Storage: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    uploadedStoragePath = uploadData?.path || storageFilePath;

    // 3. Database Transaction: Simpan data User nasabah & metadata berkas di tabel user_documents
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
          private_file_path: uploadedStoragePath as string,
          mime_type: documentFile.type || "application/octet-stream",
        },
      });

      return { user, document };
    });

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
    // Jika transaksi database gagal, bersihkan file yang sempat diupload di Supabase Storage
    if (uploadedStoragePath) {
      try {
        await supabase.storage
          .from(PRIVATE_DOCUMENTS_BUCKET)
          .remove([uploadedStoragePath]);
      } catch (cleanupErr) {
        console.error("Gagal membersihkan berkas Supabase:", cleanupErr);
      }
    }

    console.error("Error pada registrasi nasabah:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server saat registrasi." },
      { status: 500 }
    );
  }
}
