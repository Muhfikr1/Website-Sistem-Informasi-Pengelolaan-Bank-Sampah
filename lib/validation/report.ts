import { z } from "zod";
import { toDateRange, type DateRange } from "@/lib/validation/history";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // JavaScript "membetulkan" tanggal mustahil (31 Februari jadi 3 Maret), jadi cocokkan balik ke teks aslinya.
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid");

/** Parameter URL halaman laporan. Nilai yang rusak diabaikan, tidak membuat halaman error. */
export const reportQuerySchema = z.object({
  from: dateOnly.optional().catch(undefined),
  to: dateOnly.optional().catch(undefined),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

/** Mengubah parameter URL mentah menjadi rentang waktu hari penuh WIB, plus pesan jika rentangnya tidak masuk akal. */
export function resolveReportRange(raw: { from?: string | string[]; to?: string | string[] }): {
  query: ReportQuery;
  range: DateRange;
  error?: string;
} {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const query = reportQuerySchema.parse({ from: first(raw.from), to: first(raw.to) });
  const { range, error } = toDateRange(query.from, query.to);
  // Rentang tidak valid: abaikan filter sepenuhnya agar form tidak menampilkan tanggal yang tidak dipakai
  return error ? { query: {}, range: {}, error } : { query, range };
}
