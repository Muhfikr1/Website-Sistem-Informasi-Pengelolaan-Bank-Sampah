import { z } from "zod";

/**
 * Skema validasi query parameter untuk daftar penarikan admin (GET /api/admin/withdrawals)
 */
export const adminWithdrawalsQuerySchema = z.object({
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("ALL"),
  search: z.string().trim().optional().default(""),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export type AdminWithdrawalsQuery = z.infer<typeof adminWithdrawalsQuerySchema>;

/**
 * Skema validasi body untuk proses penarikan saldo (POST/PATCH /api/admin/withdrawals/[id]/process)
 * - action: 'APPROVE' | 'REJECT'
 * - rejectionReason: wajib minimal 5 karakter jika action === 'REJECT'
 */
export const processWithdrawalSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"], {
      message: "action harus berupa APPROVE atau REJECT",
    }),
    rejectionReason: z
      .string()
      .trim()
      .max(300, "Alasan penolakan maksimal 300 karakter")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "REJECT") {
      const reason = data.rejectionReason?.trim();
      if (!reason || reason.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejectionReason"],
          message: "Alasan penolakan wajib diisi minimal 5 karakter jika pengajuan ditolak.",
        });
      }
    }
  });

export type ProcessWithdrawalInput = z.infer<typeof processWithdrawalSchema>;
