const rupiahFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
});

/** 4500 -> "Rp 4.500" */
export function formatRupiah(value: number): string {
    return rupiahFormatter.format(value).replace(/\u00A0/g, " ");
}