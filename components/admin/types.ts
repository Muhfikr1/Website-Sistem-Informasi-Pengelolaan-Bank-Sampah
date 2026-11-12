/** Data satu jenis sampah yang dikirim dari server ke komponen admin. */
export interface WasteCategoryRow {
    id: string;
    code: string;
    name: string;
    unit: string;
    price: number;
    imageUrl: string | null;
    isActive: boolean;
    /** Jumlah item setoran yang memakai jenis sampah ini. */
    usedCount: number;
}