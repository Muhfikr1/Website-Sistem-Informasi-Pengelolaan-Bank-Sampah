import { z } from "zod";

// Nominal penarikan dikirim sebagai TEKS angka bulat rupiah (bukan angka JS)
// agar tidak terkena kesalahan pembulatan. Maksimal 12 digit.
export const createWithdrawalSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "Nominal harus berupa angka bulat rupiah tanpa titik, koma, atau huruf.")
    .refine((v) => Number(v) > 0, "Nominal penarikan harus lebih dari Rp 0."),
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;