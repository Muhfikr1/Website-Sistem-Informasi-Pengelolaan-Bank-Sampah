import { z } from "zod";

// Berat dikirim sebagai TEKS (bukan angka JS) agar tidak terkena kesalahan pembulatan float.
// Aturan: angka positif, maksimal 2 digit desimal, maksimal 99.999.999,99 kg.
const weightSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Berat harus angka dengan maksimal 2 angka desimal (gunakan titik).")
  .refine((v) => Number(v) > 0, "Berat harus lebih dari 0.");

export const depositItemSchema = z.object({
  waste_category_id: z.string().min(1, "Pilih kategori sampah."),
  weight_kg: weightSchema,
});

export const createDepositSchema = z
  .object({
    nasabah_id: z.string().min(1, "Pilih nasabah."),
    items: z.array(depositItemSchema).min(1, "Minimal 1 jenis sampah.").max(20, "Maksimal 20 baris sampah."),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (seen.has(item.waste_category_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "waste_category_id"],
          message: "Kategori sampah sudah dipilih di baris lain. Gabungkan beratnya.",
        });
      }
      seen.add(item.waste_category_id);
    });
  });

export type CreateDepositInput = z.infer<typeof createDepositSchema>;