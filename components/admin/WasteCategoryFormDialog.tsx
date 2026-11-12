"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";
import {
    CATALOG_IMAGE_ACCEPT_ATTR,
    MAX_CATALOG_IMAGE_BYTES,
    validateCatalogImageMeta,
} from "@/lib/image-rules";
import { formatFileSize } from "@/lib/upload-rules";
import type { WasteCategoryRow } from "./types";

interface FormDialogProps {
    mode: "create" | "edit";
    item?: WasteCategoryRow;
    onClose: () => void;
    onSaved: (message: string) => void;
}

type FieldErrors = Partial<Record<"code" | "name" | "price" | "image", string>>;

const MAX_PRICE = 999_999_999_999.99;

/**
 * VALIDASI LAPIS 1 (browser): memberi umpan balik cepat tanpa menghubungi server.
 * Server tetap memeriksa ulang (Lapis 2) dan database punya CHECK constraint (Lapis 3).
 */
function validateFields(
    values: { code: string; name: string; price: string },
    mode: "create" | "edit"
): FieldErrors {
    const errors: FieldErrors = {};

    if (mode === "create" && !/^[A-Z0-9-]{2,20}$/.test(values.code.trim().toUpperCase())) {
        errors.code = "Kode 2-20 karakter: huruf, angka, atau tanda hubung.";
    }

    const name = values.name.trim();
    if (name.length < 2) errors.name = "Nama minimal 2 karakter.";
    else if (name.length > 100) errors.name = "Nama maksimal 100 karakter.";

    const price = Number(values.price);
    if (values.price.trim() === "" || Number.isNaN(price)) errors.price = "Harga harus berupa angka.";
    else if (price <= 0) errors.price = "Harga harus lebih dari 0.";
    else if (price > MAX_PRICE) errors.price = "Harga terlalu besar.";
    else if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) {
        errors.price = "Harga maksimal 2 angka di belakang koma.";
    }

    return errors;
}

export default function WasteCategoryFormDialog({ mode, item, onClose, onSaved }: FormDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const previewRef = useRef<string | null>(null);

    const [code, setCode] = useState(item?.code ?? "");
    const [name, setName] = useState(item?.name ?? "");
    const [price, setPrice] = useState(item ? String(item.price) : "");
    const [isActive, setIsActive] = useState(item?.isActive ?? true);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // <dialog> bawaan browser: fokus terkunci di dalam dialog dan Esc menutupnya
    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal();
        return () => {
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        };
    }, []);

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        if (previewRef.current) {
            URL.revokeObjectURL(previewRef.current);
            previewRef.current = null;
        }

        if (!selected) {
            setFile(null);
            setPreview(null);
            setErrors((prev) => ({ ...prev, image: undefined }));
            return;
        }

        const message = validateCatalogImageMeta(selected);
        if (message) {
            event.target.value = ""; // kosongkan agar berkas yang sama bisa dipilih ulang
            setFile(null);
            setPreview(null);
            setErrors((prev) => ({ ...prev, image: message }));
            return;
        }

        const url = URL.createObjectURL(selected);
        previewRef.current = url;
        setFile(selected);
        setPreview(url);
        setErrors((prev) => ({ ...prev, image: undefined }));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const fieldErrors = validateFields({ code, name, price }, mode);
        setErrors(fieldErrors);
        setSubmitError(null);
        if (Object.keys(fieldErrors).length > 0) return;

        setSubmitting(true);
        try {
            const body = new FormData();
            if (mode === "create") body.set("code", code.trim().toUpperCase());
            body.set("name", name.trim());
            body.set("price", price.trim());
            body.set("is_active", String(isActive));
            if (file) body.set("image", file);

            const url =
                mode === "create" ? "/api/admin/waste-categories" : `/api/admin/waste-categories/${item?.id}`;
            const response = await fetch(url, { method: mode === "create" ? "POST" : "PATCH", body });
            const data = (await response.json().catch(() => null)) as { error?: string } | null;

            if (!response.ok) {
                setSubmitError(data?.error ?? "Gagal menyimpan data. Coba lagi.");
                return;
            }
            onSaved(
                mode === "create"
                    ? `Jenis sampah ${code.trim().toUpperCase()} berhasil dibuat.`
                    : `Perubahan ${item?.code} berhasil disimpan.`
            );
        } catch {
            setSubmitError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
        } finally {
            setSubmitting(false);
        }
    }

    const inputClass = (hasError: boolean) =>
        `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500 ${hasError ? "border-red-400 bg-red-50" : "border-neutral-300 bg-white"
        }`;

    const shownImage = preview ?? item?.imageUrl ?? null;

    return (
        <dialog
            ref={dialogRef}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === dialogRef.current) onClose();
            }}
            aria-labelledby="category-dialog-title"
            className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/40"
        >
            <form onSubmit={handleSubmit} noValidate className="p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <h2 id="category-dialog-title" className="text-lg font-bold">
                        {mode === "create" ? "Tambah Jenis Sampah" : `Ubah ${item?.code}`}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup"
                        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="space-y-4">
                    {submitError && <ErrorAlert title="Gagal menyimpan" message={submitError} />}

                    <div>
                        <label htmlFor="cat-code" className="text-sm font-semibold">Kode</label>
                        <input
                            id="cat-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            readOnly={mode === "edit"}
                            placeholder="SMP-06"
                            aria-invalid={Boolean(errors.code)}
                            aria-describedby={errors.code ? "cat-code-error" : undefined}
                            className={`${inputClass(Boolean(errors.code))} font-mono ${mode === "edit" ? "bg-neutral-100 text-neutral-500" : ""}`}
                        />
                        {errors.code && <p id="cat-code-error" className="mt-1 text-xs text-red-600">{errors.code}</p>}
                    </div>

                    <div>
                        <label htmlFor="cat-name" className="text-sm font-semibold">Nama jenis sampah</label>
                        <input
                            id="cat-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Botol Kaca Bersih"
                            aria-invalid={Boolean(errors.name)}
                            aria-describedby={errors.name ? "cat-name-error" : undefined}
                            className={inputClass(Boolean(errors.name))}
                        />
                        {errors.name && <p id="cat-name-error" className="mt-1 text-xs text-red-600">{errors.name}</p>}
                    </div>

                    <div>
                        <label htmlFor="cat-price" className="text-sm font-semibold">Harga per kg (Rp)</label>
                        <input
                            id="cat-price"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="4000"
                            aria-invalid={Boolean(errors.price)}
                            aria-describedby={errors.price ? "cat-price-error" : "cat-price-hint"}
                            className={inputClass(Boolean(errors.price))}
                        />
                        {errors.price ? (
                            <p id="cat-price-error" className="mt-1 text-xs text-red-600">{errors.price}</p>
                        ) : (
                            <p id="cat-price-hint" className="mt-1 text-xs text-neutral-500">
                                Perubahan harga hanya berlaku untuk setoran berikutnya. Riwayat lama tidak berubah.
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="cat-image" className="text-sm font-semibold">Foto katalog (opsional)</label>
                        <div className="mt-1 flex items-center gap-4">
                            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400">
                                {shownImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={shownImage} alt="Pratinjau foto" className="h-full w-full object-cover" />
                                ) : (
                                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <input
                                    id="cat-image"
                                    type="file"
                                    accept={CATALOG_IMAGE_ACCEPT_ATTR}
                                    onChange={handleFileChange}
                                    aria-invalid={Boolean(errors.image)}
                                    aria-describedby={errors.image ? "cat-image-error" : "cat-image-hint"}
                                    className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                                />
                                {errors.image ? (
                                    <p id="cat-image-error" className="mt-1 text-xs text-red-600">{errors.image}</p>
                                ) : (
                                    <p id="cat-image-hint" className="mt-1 text-xs text-neutral-500">
                                        JPG, PNG, atau WebP. Maksimal {formatFileSize(MAX_CATALOG_IMAGE_BYTES)}.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-emerald-600"
                        />
                        Aktif (tampil di katalog dan bisa dipilih petugas)
                    </label>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {submitting ? "Menyimpan…" : "Simpan"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}