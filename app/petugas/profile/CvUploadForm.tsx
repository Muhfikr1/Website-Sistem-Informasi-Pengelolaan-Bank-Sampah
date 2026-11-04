"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { DOCUMENT_ACCEPT_ATTR, formatFileSize, validateDocumentMeta } from "@/lib/upload-rules";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function CvUploadForm({ hasCv }: { hasCv: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Validasi Lapis 1: berjalan saat berkas dipilih, sebelum ada request jaringan.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setStatus({ kind: "idle" });

    if (!selected) {
      setFile(null);
      setFieldError(null);
      return;
    }

    const message = validateDocumentMeta(selected);
    setFieldError(message);
    setFile(message ? null : selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setFieldError("Pilih berkas CV terlebih dahulu.");
      return;
    }

    setStatus({ kind: "uploading" });
    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/petugas/cv", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setStatus({ kind: "error", message: data?.error ?? "Gagal mengunggah CV." });
        return;
      }

      setStatus({ kind: "success", message: "CV berhasil diunggah." });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh(); // muat ulang data server agar kartu CV terbaru tampil
    } catch {
      setStatus({
        kind: "error",
        message: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
      });
    }
  }

  const uploading = status.kind === "uploading";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="cv-file" className="block text-sm font-medium text-neutral-800">
          {hasCv ? "Ganti CV" : "Unggah CV"}
        </label>
        <p id="cv-hint" className="text-xs text-neutral-500 mt-0.5">
          Format PDF, JPG, atau PNG. Ukuran maksimal 5 MB.
        </p>
        <input
          ref={inputRef}
          id="cv-file"
          name="file"
          type="file"
          accept={DOCUMENT_ACCEPT_ATTR}
          onChange={handleChange}
          disabled={uploading}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "cv-hint cv-error" : "cv-hint"}
          className="mt-2 block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-60"
        />
        {file && (
          <p className="mt-2 text-xs text-neutral-600">
            Dipilih: <span className="font-medium">{file.name}</span> ({formatFileSize(file.size)})
          </p>
        )}
        {fieldError && (
          <p id="cv-error" role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {fieldError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={uploading || !file}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span>{uploading ? "Mengunggah..." : "Unggah CV"}</span>
      </button>

      <div aria-live="polite">
        {status.kind === "success" && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}