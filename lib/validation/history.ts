import { z } from "zod";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // JavaScript "membetulkan" tanggal mustahil (31 Februari jadi 3 Maret), jadi cocokkan balik ke teks aslinya.
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Tanggal tidak valid");

const pageNumber = z.coerce.number().int().min(1).catch(1);

/** Parameter URL dashboard nasabah. Nilai yang rusak diganti default, tidak membuat halaman error. */
export const dashboardQuerySchema = z.object({
  from: dateOnly.optional().catch(undefined),
  to: dateOnly.optional().catch(undefined),
  dpage: pageNumber,
  mpage: pageNumber,
});

export interface DateRange {
  gte?: Date;
  lte?: Date;
}

/**
 * Mengubah tanggal "YYYY-MM-DD" menjadi rentang waktu hari penuh zona WIB (UTC+7).
 * Mengembalikan error jika tanggal awal lebih besar dari tanggal akhir.
 */
export function toDateRange(from?: string, to?: string): { range: DateRange; error?: string } {
  if (from && to && from > to) {
    return { range: {}, error: "Tanggal awal tidak boleh lebih besar dari tanggal akhir. Filter diabaikan." };
  }
  const range: DateRange = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000+07:00`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+07:00`);
  return { range };
}