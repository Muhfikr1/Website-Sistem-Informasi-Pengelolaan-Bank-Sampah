"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Recycle,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  UploadCloud,
  FileCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!documentFile) {
      setErrorMessage("Silakan lampirkan dokumen KTP atau Berkas Pendaftaran Anda.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("phone", phone);
      formData.append("address", address);
      formData.append("document", documentFile);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Gagal melakukan pendaftaran.");
        setLoading(false);
        return;
      }

      setSuccessMessage(
        "Pendaftaran nasabah berhasil! Berkas Anda tersimpan aman. Mengarahkan ke halaman login..."
      );

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.error("Register error:", err);
      setErrorMessage("Terjadi masalah jaringan atau server.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-neutral-100 flex items-center justify-center p-4 py-12">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-emerald-100 p-8 sm:p-10 relative">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/30">
            <Recycle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Registrasi Nasabah Baru
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Bergabunglah dengan program Bank Sampah dan kelola tabungan lingkungan Anda
          </p>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-800 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
              Nama Lengkap Nasabah *
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth. Budi Pratama"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                Alamat Email *
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="budi@example.com"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                Kata Sandi *
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                Nomor Telepon / WhatsApp
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08123456789"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                Alamat Domisili
              </label>
              <div className="relative">
                <MapPin className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Merpati No. 12, RT 01/02"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Upload Document Section */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
              Unggah Dokumen KTP / Berkas Pendaftaran *
            </label>
            <div className="relative border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 rounded-xl p-5 text-center transition-all cursor-pointer">
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center">
                {documentFile ? (
                  <>
                    <FileCheck className="w-8 h-8 text-emerald-600 mb-2" />
                    <span className="text-sm font-semibold text-emerald-900">
                      {documentFile.name}
                    </span>
                    <span className="text-xs text-neutral-500 mt-0.5">
                      {(documentFile.size / 1024).toFixed(1)} KB (Klik untuk mengganti)
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-emerald-600 mb-2" />
                    <span className="text-sm font-semibold text-neutral-800">
                      Klik atau seret file dokumen ke sini
                    </span>
                    <span className="text-xs text-neutral-500 mt-1">
                      Format didukung: PDF, PNG, JPG (Maks. 5MB)
                    </span>
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1.5">
              * Berkas Anda dienkripsi dan disimpan di folder privat dengan proteksi hak akses ketat.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Pendaftaran...</span>
              </>
            ) : (
              <span>Daftar Sebagai Nasabah</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
          <p className="text-sm text-neutral-600">
            Sudah memiliki akun nasabah atau petugas?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
