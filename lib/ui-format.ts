const rupiahInteger = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
});

const rupiahDecimal = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** 4500 -> "Rp 4.500", 2500.5 -> "Rp 2.500,50" */
export function formatRupiah(value: number): string {
    const formatter = Number.isInteger(value) ? rupiahInteger : rupiahDecimal;
    return formatter.format(value).replace(/\u00A0/g, " ");
}