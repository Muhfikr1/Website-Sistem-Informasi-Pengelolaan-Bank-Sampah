import { z } from "zod";

/** Batas atas harga: kolom database Decimal(15,2). */
export const MAX_PRICE_PER_KG = 999_999_999_999.99;

const priceSchema = z.coerce
    .number({ error: "Harga harus berupa angka." })
    .positive("Harga harus lebih dari 0.")
    .max(MAX_PRICE_PER_KG, "Harga terlalu besar.")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
        message: "Harga maksimal 2 angka di belakang koma.",
    });

const nameSchema = z
    .string({ error: "Nama jenis sampah wajib diisi." })
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter.");

const codeSchema = z
    .string({ error: "Kode wajib diisi." })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, "Kode 2-20 karakter: huruf, angka, atau tanda hubung.");

const boolStringSchema = z
    .enum(["true", "false"], { error: "Status harus true atau false." })
    .transform((value) => value === "true");

/** Lapis 2 untuk POST: membuat jenis sampah baru. */
export const createWasteCategorySchema = z.object({
    code: codeSchema,
    name: nameSchema,
    price: priceSchema,
    is_active: boolStringSchema.default(true),
});

/** Lapis 2 untuk PATCH: semua field opsional, kode tidak boleh diubah. */
export const updateWasteCategorySchema = z.object({
    name: nameSchema.optional(),
    price: priceSchema.optional(),
    is_active: boolStringSchema.optional(),
});

export const idParamSchema = z.uuid({ message: "ID jenis sampah tidak valid." });

/**
 * Mengambil field teks dari FormData menjadi objek biasa.
 * Field kosong atau berupa berkas dianggap tidak dikirim.
 */
export function pickFormFields(formData: FormData, keys: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
        const value = formData.get(key);
        if (typeof value === "string" && value.trim() !== "") result[key] = value;
    }
    return result;
}