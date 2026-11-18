import Link from "next/link";

interface PaginationProps {
  /** Nama parameter URL untuk halaman ini, misalnya "dpage" atau "mpage". */
  pageParam: string;
  page: number;
  totalPages: number;
  /** Parameter URL lain yang harus tetap ada (misalnya from dan to). */
  keep: Record<string, string | number | undefined>;
}

function buildHref(pageParam: string, target: number, keep: PaginationProps["keep"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(keep)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  params.set(pageParam, String(target));
  return `/nasabah/dashboard?${params.toString()}`;
}

/** Navigasi halaman berbasis tautan biasa, jadi bisa dipakai dengan keyboard (Tab dan Enter). */
export default function Pagination({ pageParam, page, totalPages, keep }: PaginationProps) {
  if (totalPages <= 1) return null;
  const base = "rounded-lg border px-3 py-1.5 text-xs font-medium";
  const disabled = `${base} cursor-not-allowed border-neutral-200 text-neutral-300`;
  const enabled = `${base} border-neutral-300 text-neutral-700 hover:bg-neutral-50`;

  return (
    <nav aria-label="Navigasi halaman" className="mt-4 flex items-center justify-between">
      {page > 1 ? (
        <Link href={buildHref(pageParam, page - 1, keep)} className={enabled}>
          ← Sebelumnya
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>← Sebelumnya</span>
      )}
      <span className="text-xs text-neutral-500">
        Halaman {page} dari {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={buildHref(pageParam, page + 1, keep)} className={enabled}>
          Berikutnya →
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>Berikutnya →</span>
      )}
    </nav>
  );
}