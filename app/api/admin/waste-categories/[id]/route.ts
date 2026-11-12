import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPublicCatalogImage } from "@/lib/supabase";
import { extractCatalogObjectKey, removeCatalogObject } from "@/lib/catalog-storage";
import { checkRateLimit, createRateLimitResponse } from "@/lib/ratelimit";
import { apiLogger, startTimer } from "@/lib/logger";
import { detectImageMimeFromBytes, validateCatalogImageMeta } from "@/lib/image-rules";
import {
    idParamSchema,
    pickFormFields,
    updateWasteCategorySchema,
} from "@/lib/validation/waste-category";

type RouteContext = { params: Promise<{ id: string }> };

/** Pemeriksaan sesi admin dan rate limit yang sama untuk PATCH dan DELETE. */
async function authorizeAdmin(request: NextRequest, operation: string) {
    const log = apiLogger.child({ operation });
    const session = await getSession(request);
    if (!session) {
        return { error: NextResponse.json({ error: "Anda harus login terlebih dahulu." }, { status: 401 }) };
    }
    if (session.role !== "admin") {
        log.warn({ userId: session.id, role: session.role }, "Akses ditolak: bukan admin");
        return { error: NextResponse.json({ error: "Hanya admin yang boleh mengelola jenis sampah." }, { status: 403 }) };
    }
    const rate = checkRateLimit(`waste-category-write:${session.id}`, { limit: 30, windowMs: 60 * 1000 });
    if (!rate.success) {
        return { error: createRateLimitResponse(rate.reset) };
    }
    return { session, log };
}

/**
 * PATCH /api/admin/waste-categories/:id
 * Mengubah nama, harga per kg, status aktif, dan/atau foto.
 * Riwayat setoran tidak tersentuh: harga lama tersimpan di deposit_items.price_per_kg_snapshot.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    const stop = startTimer();
    const auth = await authorizeAdmin(request, "waste_category_update");
    if ("error" in auth) return auth.error;
    const { session, log } = auth;

    const idResult = idParamSchema.safeParse((await context.params).id);
    if (!idResult.success) {
        return NextResponse.json({ error: idResult.error.issues[0].message }, { status: 400 });
    }
    const id = idResult.data;

    let newUploadedPath: string | null = null;

    try {
        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json({ error: "Permintaan harus berupa multipart/form-data." }, { status: 400 });
        }

        const parsed = updateWasteCategorySchema.safeParse(
            pickFormFields(formData, ["name", "price", "is_active"])
        );
        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message ?? "Data tidak valid.";
            log.warn({ userId: session.id, categoryId: id, message }, "Validasi ubah jenis sampah gagal");
            return NextResponse.json({ error: message }, { status: 400 });
        }

        // Validasi gambar baru (opsional)
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

        const { name, price, is_active } = parsed.data;
        if (name === undefined && price === undefined && is_active === undefined && !imageBuffer) {
            return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
        }

        const existing = await prisma.wasteCategory.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Jenis sampah tidak ditemukan." }, { status: 404 });
        }

        const data: Prisma.WasteCategoryUpdateInput = {};
        if (name !== undefined) data.name = name;
        if (price !== undefined) data.current_price_per_kg = price;
        if (is_active !== undefined) data.is_active = is_active;

        if (imageBuffer) {
            const uploaded = await uploadPublicCatalogImage(imageBuffer, imageName, imageMime);
            newUploadedPath = uploaded.path;
            data.public_image_url = uploaded.publicUrl;
        }

        const updated = await prisma.wasteCategory.update({ where: { id }, data });

        // Hapus gambar lama dari storage setelah database berhasil diperbarui
        if (newUploadedPath) {
            await removeCatalogObject(extractCatalogObjectKey(existing.public_image_url), log);
            newUploadedPath = null;
        }

        const priceChanged =
            price !== undefined && !existing.current_price_per_kg.equals(updated.current_price_per_kg);
        log.info(
            {
                userId: session.id,
                categoryId: id,
                code: existing.code,
                priceChanged,
                oldPrice: priceChanged ? existing.current_price_per_kg.toNumber() : undefined,
                newPrice: priceChanged ? updated.current_price_per_kg.toNumber() : undefined,
                duration_ms: stop(),
            },
            "Jenis sampah diperbarui"
        );

        return NextResponse.json({
            success: true,
            category: {
                id: updated.id,
                code: updated.code,
                name: updated.name,
                price: updated.current_price_per_kg.toNumber(),
                imageUrl: updated.public_image_url,
                isActive: updated.is_active,
            },
        });
    } catch (err) {
        await removeCatalogObject(newUploadedPath, log);
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
            return NextResponse.json({ error: "Jenis sampah tidak ditemukan." }, { status: 404 });
        }
        log.error({ userId: session.id, categoryId: id, err, duration_ms: stop() }, "Error saat mengubah jenis sampah");
        return NextResponse.json({ error: "Terjadi kesalahan pada server saat menyimpan data." }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/waste-categories/:id
 * Hanya boleh jika jenis sampah belum pernah dipakai di setoran. Jika sudah, nonaktifkan saja.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    const stop = startTimer();
    const auth = await authorizeAdmin(request, "waste_category_delete");
    if ("error" in auth) return auth.error;
    const { session, log } = auth;

    const idResult = idParamSchema.safeParse((await context.params).id);
    if (!idResult.success) {
        return NextResponse.json({ error: idResult.error.issues[0].message }, { status: 400 });
    }
    const id = idResult.data;

    try {
        const existing = await prisma.wasteCategory.findUnique({
            where: { id },
            include: { _count: { select: { deposit_items: true } } },
        });
        if (!existing) {
            return NextResponse.json({ error: "Jenis sampah tidak ditemukan." }, { status: 404 });
        }
        if (existing._count.deposit_items > 0) {
            return NextResponse.json(
                {
                    error: `Jenis sampah ini sudah dipakai di ${existing._count.deposit_items} item setoran, jadi tidak bisa dihapus. Nonaktifkan saja.`,
                },
                { status: 409 }
            );
        }

        await prisma.wasteCategory.delete({ where: { id } });
        await removeCatalogObject(extractCatalogObjectKey(existing.public_image_url), log);

        log.info({ userId: session.id, categoryId: id, code: existing.code, duration_ms: stop() }, "Jenis sampah dihapus");
        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
            return NextResponse.json(
                { error: "Jenis sampah ini masih dipakai data lain, jadi tidak bisa dihapus. Nonaktifkan saja." },
                { status: 409 }
            );
        }
        log.error({ userId: session.id, categoryId: id, err, duration_ms: stop() }, "Error saat menghapus jenis sampah");
        return NextResponse.json({ error: "Terjadi kesalahan pada server saat menghapus data." }, { status: 500 });
    }
}