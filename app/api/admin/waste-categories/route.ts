import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPublicCatalogImage } from "@/lib/supabase";
import { removeCatalogObject } from "@/lib/catalog-storage";
import { checkRateLimit, createRateLimitResponse } from "@/lib/ratelimit";
import { apiLogger, startTimer } from "@/lib/logger";
import { detectImageMimeFromBytes, validateCatalogImageMeta } from "@/lib/image-rules";
import { createWasteCategorySchema, pickFormFields } from "@/lib/validation/waste-category";

/**
 * POST /api/admin/waste-categories
 * Membuat jenis sampah baru (multipart/form-data: code, name, price, is_active, image?).
 * Hanya admin. Validasi Lapis 2 di sini; Lapis 3 (CHECK harga > 0, UNIQUE code) di database.
 */
export async function POST(request: NextRequest) {
    const stop = startTimer();
    const log = apiLogger.child({ operation: "waste_category_create" });

    // 1. Autentikasi dan otorisasi. Middleware tidak melindungi /api/*, jadi wajib dicek di sini.
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: "Anda harus login terlebih dahulu." }, { status: 401 });
    }
    if (session.role !== "admin") {
        log.warn({ userId: session.id, role: session.role }, "Tambah jenis sampah ditolak: bukan admin");
        return NextResponse.json({ error: "Hanya admin yang boleh mengelola jenis sampah." }, { status: 403 });
    }

    // 2. Rate limiting per admin
    const rate = checkRateLimit(`waste-category-write:${session.id}`, { limit: 30, windowMs: 60 * 1000 });
    if (!rate.success) {
        return createRateLimitResponse(rate.reset);
    }

    let uploadedPath: string | null = null;

    try {
        // 3. Baca dan validasi field teks
        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json({ error: "Permintaan harus berupa multipart/form-data." }, { status: 400 });
        }

        const parsed = createWasteCategorySchema.safeParse(
            pickFormFields(formData, ["code", "name", "price", "is_active"])
        );
        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message ?? "Data tidak valid.";
            log.warn({ userId: session.id, message }, "Validasi jenis sampah gagal");
            return NextResponse.json({ error: message }, { status: 400 });
        }
        const { code, name, price, is_active } = parsed.data;

        // 4. Validasi gambar (opsional): ukuran, tipe, lalu isi aslinya
        let imageBuffer: Buffer | null = null;
        let imageName = "";
        let imageMime = "";
        const rawImage = formData.get("image");
        if (rawImage instanceof File && rawImage.size > 0) {
            const metaError = validateCatalogImageMeta(rawImage);
            if (metaError) {
                return NextResponse.json({ error: metaError }, { status: 400 });
            }
            imageBuffer = Buffer.from(await rawImage.arrayBuffer());
            const detected = detectImageMimeFromBytes(imageBuffer);
            if (!detected) {
                log.warn({ userId: session.id, declaredType: rawImage.type }, "Isi gambar katalog tidak sesuai format");
                return NextResponse.json({ error: "Isi berkas bukan gambar JPG, PNG, atau WebP yang valid." }, { status: 400 });
            }
            imageName = rawImage.name;
            imageMime = detected;
        }

        // 5. Cegah kode ganda sebelum mengunggah gambar
        const existing = await prisma.wasteCategory.findUnique({ where: { code }, select: { id: true } });
        if (existing) {
            return NextResponse.json({ error: `Kode ${code} sudah dipakai jenis sampah lain.` }, { status: 409 });
        }

        // 6. Unggah gambar ke Supabase Public Bucket 'catalog'
        let publicUrl: string | null = null;
        if (imageBuffer) {
            const uploaded = await uploadPublicCatalogImage(imageBuffer, imageName, imageMime);
            uploadedPath = uploaded.path;
            publicUrl = uploaded.publicUrl;
        }

        // 7. Simpan ke database
        const created = await prisma.wasteCategory.create({
            data: {
                code,
                name,
                unit: "kg",
                current_price_per_kg: price,
                public_image_url: publicUrl,
                is_active,
            },
        });
        uploadedPath = null; // sudah tersimpan, tidak perlu rollback

        log.info(
            { userId: session.id, categoryId: created.id, code, duration_ms: stop() },
            "Jenis sampah baru dibuat"
        );
        return NextResponse.json(
            {
                success: true,
                category: {
                    id: created.id,
                    code: created.code,
                    name: created.name,
                    price: created.current_price_per_kg.toNumber(),
                    imageUrl: created.public_image_url,
                    isActive: created.is_active,
                },
            },
            { status: 201 }
        );
    } catch (err) {
        // Rollback: hapus gambar yang sudah terunggah jika penyimpanan database gagal
        await removeCatalogObject(uploadedPath, log);

        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return NextResponse.json({ error: "Kode jenis sampah sudah dipakai." }, { status: 409 });
        }
        log.error({ userId: session.id, err, duration_ms: stop() }, "Error saat membuat jenis sampah");
        return NextResponse.json({ error: "Terjadi kesalahan pada server saat menyimpan data." }, { status: 500 });
    }
}