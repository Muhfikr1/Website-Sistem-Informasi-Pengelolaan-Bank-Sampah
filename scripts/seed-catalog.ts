/**
 * Seeder katalog sampah (Orang 2 - Hari 1-2).
 *  1. Membuat bucket publik 'catalog' di Supabase Storage (jika belum ada)
 *  2. Mengunggah 5 foto dari scripts/catalog-images/ (atau placeholder SVG jika file belum ada)
 *  3. Mengisi tabel waste_categories (upsert berdasarkan code, aman dijalankan berulang)
 *
 * Jalankan:  npx tsx --env-file=.env scripts/seed-catalog.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { supabase, SUPABASE_PUBLIC_BUCKET } from "../lib/supabase";

const IMAGE_DIR = path.join(process.cwd(), "scripts", "catalog-images");

const CATEGORIES = [
    { code: "SMP-01", name: "Botol Plastik PET Bersih", price: 4000, base: "botol_pet", color: "#0ea5e9" },
    { code: "SMP-02", name: "Kardus / Karton Kering", price: 2500, base: "kardus", color: "#d97706" },
    { code: "SMP-03", name: "Kaleng Aluminium", price: 12000, base: "aluminium", color: "#64748b" },
    { code: "SMP-04", name: "Kertas HVS / Buku Tulis", price: 3000, base: "kertas_hvs", color: "#16a34a" },
    { code: "SMP-05", name: "Besi / Logam Campuran", price: 5000, base: "besi", color: "#78716c" },
];

const EXT_MIME: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

async function ensurePublicBucket() {
    const { data: existing } = await supabase.storage.getBucket(SUPABASE_PUBLIC_BUCKET);
    if (!existing) {
        const { error } = await supabase.storage.createBucket(SUPABASE_PUBLIC_BUCKET, {
            public: true,
            fileSizeLimit: 2 * 1024 * 1024, // 2 MB sesuai spesifikasi
        });
        if (error) throw new Error(`Gagal membuat bucket: ${error.message}`);
        console.log(`✔ Bucket publik '${SUPABASE_PUBLIC_BUCKET}' dibuat`);
    } else if (!existing.public) {
        const { error } = await supabase.storage.updateBucket(SUPABASE_PUBLIC_BUCKET, { public: true });
        if (error) throw new Error(`Gagal mengubah bucket jadi publik: ${error.message}`);
        console.log(`✔ Bucket '${SUPABASE_PUBLIC_BUCKET}' diubah menjadi publik`);
    } else {
        console.log(`✔ Bucket '${SUPABASE_PUBLIC_BUCKET}' sudah ada & publik`);
    }
}

function placeholderSvg(title: string, color: string): Buffer {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<rect width="800" height="600" fill="${color}"/>
<text x="400" y="300" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle">${title}</text>
<text x="400" y="355" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">Foto katalog (placeholder)</text>
</svg>`;
    return Buffer.from(svg, "utf-8");
}

async function uploadImage(cat: (typeof CATEGORIES)[number]): Promise<string> {
    let body: Buffer | null = null;
    let key = "";
    let contentType = "";

    for (const [ext, mime] of Object.entries(EXT_MIME)) {
        try {
            body = await readFile(path.join(IMAGE_DIR, `${cat.base}.${ext}`));
            key = `${cat.base}.${ext}`;
            contentType = mime;
            break;
        } catch {
            /* file tidak ada, coba ekstensi berikutnya */
        }
    }

    if (!body) {
        body = placeholderSvg(cat.name, cat.color);
        key = `${cat.base}.svg`;
        contentType = "image/svg+xml";
        console.log(`  ! ${cat.base}.jpg tidak ditemukan -> memakai placeholder SVG`);
    }

    const { error } = await supabase.storage
        .from(SUPABASE_PUBLIC_BUCKET)
        .upload(key, body, { contentType, upsert: true });
    if (error) throw new Error(`Upload ${key} gagal: ${error.message}`);

    return supabase.storage.from(SUPABASE_PUBLIC_BUCKET).getPublicUrl(key).data.publicUrl;
}

async function main() {
    await ensurePublicBucket();

    for (const cat of CATEGORIES) {
        const publicUrl = await uploadImage(cat);
        await prisma.wasteCategory.upsert({
            where: { code: cat.code },
            // Harga HANYA diisi saat pertama kali dibuat, supaya perubahan harga admin tidak tertimpa
            update: { name: cat.name, public_image_url: publicUrl, is_active: true },
            create: {
                code: cat.code,
                name: cat.name,
                unit: "kg",
                current_price_per_kg: cat.price,
                public_image_url: publicUrl,
                is_active: true,
            },
        });
        console.log(`✔ ${cat.code} ${cat.name} -> ${publicUrl}`);
    }
}

main()
    .catch((e) => {
        console.error("✘ Seed katalog gagal:", e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());