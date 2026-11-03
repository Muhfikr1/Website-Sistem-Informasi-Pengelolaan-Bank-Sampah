/**
 * Seeder awal (minggu 1): 1 admin, 2 petugas, 5 nasabah, 5 jenis sampah,
 * dan metadata dokumen privat (CV petugas, KTP nasabah).
 *
 * Aman dijalankan berulang: seeder hanya MEMBUAT data yang belum ada
 * (upsert tanpa update), jadi tidak menimpa data uji rekan satu tim
 * pada database bersama.
 *
 * Jalankan: npm run db:seed
 * Kata sandi semua akun: password123
 */
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { supabase, SUPABASE_PRIVATE_BUCKET, SUPABASE_PUBLIC_BUCKET } from "../lib/supabase";
import { createContextLogger, logTimed } from "../lib/logger";

const log = createContextLogger("SEED");

const DEFAULT_PASSWORD = "password123";

// Berkas contoh dari repo; dipakai untuk semua dokumen privat dummy.
const SAMPLE_FILE_PATH = path.join(process.cwd(), "sample_ktp.pdf");

interface SeedDocument {
  type: DocumentType;
  objectKey: string; // lokasi berkas di Private Bucket
}

interface SeedUser {
  name: string;
  email: string;
  role: Role;
  balance: number;
  document?: SeedDocument;
}

const USERS: SeedUser[] = [
  { name: "Raka Pratama", email: "admin@banksampah.id", role: "admin", balance: 0 },
  {
    name: "Dimas Saputra",
    email: "petugas1@banksampah.id",
    role: "petugas",
    balance: 0,
    document: { type: "CV", objectKey: "cv/cv_dimas_petugas1.pdf" },
  },
  { name: "Rina Wulandari", email: "petugas2@banksampah.id", role: "petugas", balance: 0 },
  {
    name: "Budi Santoso",
    email: "budi@mail.com",
    role: "nasabah",
    balance: 45000,
    document: { type: "KTP", objectKey: "ktp/ktp_pendaftaran_budi.pdf" },
  },
  {
    name: "Siti Aminah",
    email: "siti@mail.com",
    role: "nasabah",
    balance: 25000,
    document: { type: "KTP", objectKey: "ktp/ktp_pendaftaran_siti.pdf" },
  },
  {
    name: "Andi Wijaya",
    email: "andi@mail.com",
    role: "nasabah",
    balance: 36000,
    document: { type: "KTP", objectKey: "ktp/ktp_pendaftaran_andi.pdf" },
  },
  {
    name: "Dewi Lestari",
    email: "dewi@mail.com",
    role: "nasabah",
    balance: 30000,
    document: { type: "KTP", objectKey: "ktp/ktp_pendaftaran_dewi.pdf" },
  },
  {
    name: "Hendra Gunawan",
    email: "hendra@mail.com",
    role: "nasabah",
    balance: 31250,
    document: { type: "KTP", objectKey: "ktp/ktp_pendaftaran_hendra.pdf" },
  },
];

const WASTE_CATEGORIES = [
  { code: "SMP-01", name: "Botol Plastik PET Bersih", price: 4000, imageFile: "botol_pet.jpg" },
  { code: "SMP-02", name: "Kardus / Karton Kering", price: 2500, imageFile: "kardus.jpg" },
  { code: "SMP-03", name: "Kaleng Aluminium", price: 12000, imageFile: "aluminium.jpg" },
  { code: "SMP-04", name: "Kertas HVS / Buku Tulis", price: 3000, imageFile: "kertas_hvs.jpg" },
  { code: "SMP-05", name: "Besi / Logam Campuran", price: 5000, imageFile: "besi.jpg" },
];

/** URL publik gambar katalog. Null jika NEXT_PUBLIC_SUPABASE_URL belum diisi. */
function publicCatalogUrl(fileName: string): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!baseUrl.startsWith("http")) return null;
  return supabase.storage.from(SUPABASE_PUBLIC_BUCKET).getPublicUrl(fileName).data.publicUrl;
}

async function seedWasteCategories(): Promise<number> {
  for (const item of WASTE_CATEGORIES) {
    await prisma.wasteCategory.upsert({
      where: { code: item.code },
      update: {},
      create: {
        code: item.code,
        name: item.name,
        unit: "kg",
        current_price_per_kg: item.price,
        public_image_url: publicCatalogUrl(item.imageFile),
        is_active: true,
      },
    });
  }
  return WASTE_CATEGORIES.length;
}

async function seedUsers(): Promise<Map<string, string>> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIds = new Map<string, string>();

  for (const item of USERS) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {},
      create: {
        name: item.name,
        email: item.email,
        password_hash: passwordHash,
        role: item.role,
        balance: item.balance,
      },
    });
    userIds.set(item.email, user.id);
  }
  return userIds;
}

async function seedDocuments(userIds: Map<string, string>): Promise<number> {
  const fileBytes = await fs.readFile(SAMPLE_FILE_PATH);
  let created = 0;

  for (const item of USERS) {
    if (!item.document) continue;

    const userId = userIds.get(item.email);
    if (!userId) throw new Error(`ID pengguna untuk ${item.email} tidak ditemukan.`);
    const { type, objectKey } = item.document;

    // Jika pengguna sudah mengganti dokumennya sendiri (key berbeda), jangan ditimpa.
    const existing = await prisma.userDocument.findFirst({
      where: { user_id: userId, document_type: type },
      select: { storage_object_key: true },
    });
    if (existing && existing.storage_object_key !== objectKey) continue;

    // Unggah berkas contoh agar /documents/[id]/view benar-benar bisa membukanya.
    // Gagal unggah hanya memberi peringatan: metadata di database tetap dibuat.
    const { error } = await supabase.storage
      .from(SUPABASE_PRIVATE_BUCKET)
      .upload(objectKey, fileBytes, { contentType: "application/pdf", upsert: true });
    if (error) {
      log.warn({ operation: "upload_sample", objectKey, err: error }, "Gagal mengunggah berkas contoh");
    }

    if (existing) continue; // baris sudah ada, tidak perlu dibuat lagi

    await prisma.userDocument.create({
      data: {
        user_id: userId,
        document_type: type,
        original_name: path.basename(objectKey),
        storage_bucket: SUPABASE_PRIVATE_BUCKET,
        storage_object_key: objectKey,
        mime_type: "application/pdf",
        size_bytes: fileBytes.length,
      },
    });
    created += 1;
  }
  return created;
}

async function main() {
  await logTimed(log, "seed_awal", async () => {
    const categories = await logTimed(log, "seed_waste_categories", seedWasteCategories);
    const userIds = await logTimed(log, "seed_users", seedUsers);
    const documents = await logTimed(log, "seed_documents", () => seedDocuments(userIds));
    log.info({ categories, users: userIds.size, newDocuments: documents }, "Ringkasan seeder");
  });
}

main()
  .catch(() => {
    // logTimed sudah mencatat detail error; cukup tandai proses gagal.
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());