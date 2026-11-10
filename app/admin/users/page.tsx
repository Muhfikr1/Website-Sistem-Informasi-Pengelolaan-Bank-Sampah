"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Users,
  UserCheck,
  Wallet,
  FileText,
  Search,
  UserPlus,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Shield,
  Phone,
  MapPin,
  Scale,
  Package,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { formatRupiah } from "@/lib/ui-format";

interface UserDocumentItem {
  id: string;
  documentType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  role: "nasabah" | "petugas" | "admin";
  balance: number;
  createdAt: string;
  documents: UserDocumentItem[];
  depositsCount: number;
  totalWeightKg: number;
}

interface SummaryData {
  totalNasabah: number;
  totalPetugas: number;
  totalNasabahBalance: number;
  totalDocuments: number;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

type RoleFilter = "all" | "nasabah" | "petugas";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalNasabah: 0,
    totalPetugas: 0,
    totalNasabahBalance: 0,
    totalDocuments: 0,
  });
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State Tambah Petugas
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounce search input (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch data users dari API
  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          role: roleFilter,
          page: String(currentPage),
          limit: "10",
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || `Gagal memuat data (HTTP ${res.status})`);
        }

        const data = await res.json();
        if (!ignore) {
          setUsers(data.users || []);
          setPagination(
            data.pagination || {
              total: 0,
              page: 1,
              limit: 10,
              totalPages: 1,
              hasPrev: false,
              hasNext: false,
            }
          );
          if (data.summary) {
            setSummary(data.summary);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const e = err as Error;
          setError(e.message || "Terjadi kesalahan saat memuat data pengguna.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [roleFilter, debouncedSearch, currentPage]);

  const refreshData = () => {
    setCurrentPage(1);
    setSearchInput("");
  };

  // Handle Submit Form Tambah Petugas
  const handleCreatePetugas = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validasi Frontend
    if (!formName.trim() || formName.trim().length < 2) {
      setFormError("Nama petugas minimal 2 karakter.");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setFormError("Alamat email tidak valid.");
      return;
    }
    if (formPassword.length < 6) {
      setFormError("Kata sandi minimal 6 karakter.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim().toLowerCase(),
            password: formPassword,
            phone: formPhone.trim() || null,
            address: formAddress.trim() || null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Gagal membuat akun petugas.");
        }

        setFormSuccess(`Akun petugas '${data.user.name}' berhasil dibuat!`);
        setFormName("");
        setFormEmail("");
        setFormPassword("");
        setFormPhone("");
        setFormAddress("");

        // Refresh tabel
        setRoleFilter("petugas");
        setCurrentPage(1);

        // Tutup modal setelah jeda
        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess(null);
        }, 1500);
      } catch (err: unknown) {
        const e = err as Error;
        setFormError(e.message || "Terjadi kesalahan sistem saat membuat petugas.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Kelola Nasabah & Petugas
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Pusat data nasabah, petugas operasional, dan verifikasi berkas privat (KTP, pendaftaran, CV).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormSuccess(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span>Tambah Petugas Baru</span>
        </button>
      </div>

      {/* Kartu Ringkasan (Summary Metrics) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Total Nasabah</p>
              <h3 className="text-2xl font-extrabold text-neutral-900">{summary.totalNasabah}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <UserCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Petugas Aktif</p>
              <h3 className="text-2xl font-extrabold text-neutral-900">{summary.totalPetugas}</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Saldo Mengendap</p>
              <h3 className="text-xl font-extrabold text-neutral-900">
                {formatRupiah(summary.totalNasabahBalance)}
              </h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Berkas Terunggah</p>
              <h3 className="text-2xl font-extrabold text-neutral-900">{summary.totalDocuments}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Kontrol Filter & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab Role */}
        <div className="flex rounded-xl bg-neutral-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setRoleFilter("all");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 transition-all ${
              roleFilter === "all"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Semua Pengguna
          </button>
          <button
            type="button"
            onClick={() => {
              setRoleFilter("nasabah");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 transition-all ${
              roleFilter === "nasabah"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Nasabah
          </button>
          <button
            type="button"
            onClick={() => {
              setRoleFilter("petugas");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 transition-all ${
              roleFilter === "petugas"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Petugas
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama atau email..."
            className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && <ErrorAlert title="Gagal memuat pengguna" message={error} onRetry={refreshData} />}

      {/* Tabel Data Pengguna */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="border-b border-neutral-100 bg-neutral-50/70 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th scope="col" className="px-5 py-3.5">Nama & Kontak</th>
                <th scope="col" className="px-5 py-3.5">Peran (Role)</th>
                <th scope="col" className="px-5 py-3.5">Aktivitas Sampah</th>
                <th scope="col" className="px-5 py-3.5">Saldo Rekening</th>
                <th scope="col" className="px-5 py-3.5">Berkas Pribadi (KTP/CV)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                // Skeleton loading state
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-4 w-32 rounded bg-neutral-200 mb-2"></div>
                      <div className="h-3 w-44 rounded bg-neutral-100"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-6 w-20 rounded-full bg-neutral-200"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-24 rounded bg-neutral-200"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-20 rounded bg-neutral-200"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-7 w-28 rounded-lg bg-neutral-200"></div>
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8">
                    <EmptyState
                      icon={Users}
                      title="Tidak ada data pengguna"
                      description={
                        debouncedSearch
                          ? `Tidak ditemukan pengguna yang cocok dengan kata kunci "${debouncedSearch}".`
                          : "Belum ada data pengguna yang terdaftar untuk filter ini."
                      }
                    />
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                      {/* 1. Nama & Kontak */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-neutral-900">{u.name}</div>
                        <div className="text-xs text-neutral-500">{u.email}</div>
                        {(u.phone || u.address) && (
                          <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-neutral-400">
                            {u.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {u.phone}
                              </span>
                            )}
                            {u.address && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="line-clamp-1">{u.address}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 2. Role Badge */}
                      <td className="px-5 py-4">
                        {u.role === "admin" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                        {u.role === "petugas" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                            <UserCheck className="h-3 w-3" />
                            Petugas
                          </span>
                        )}
                        {u.role === "nasabah" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            <Users className="h-3 w-3" />
                            Nasabah
                          </span>
                        )}
                      </td>

                      {/* 3. Total Berat & Transaksi Sampah */}
                      <td className="px-5 py-4">
                        {u.role === "nasabah" ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                              <Scale className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{u.totalWeightKg} kg</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              <Package className="h-3 w-3 text-neutral-400" />
                              <span>{u.depositsCount} kali setoran</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>

                      {/* 4. Saldo Aktif */}
                      <td className="px-5 py-4">
                        {u.role === "nasabah" ? (
                          <span className="font-extrabold text-neutral-900">
                            {formatRupiah(u.balance)}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>

                      {/* 5. Berkas Pribadi (KTP, Pendaftaran, CV) */}
                      <td className="px-5 py-4">
                        {u.documents && u.documents.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {u.documents.map((doc) => (
                              <a
                                key={doc.id}
                                href={`/documents/${doc.id}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs hover:bg-neutral-50 hover:border-slate-400 transition-colors"
                              >
                                <FileText className="h-3.5 w-3.5 text-slate-600" />
                                <span className="max-w-[130px] truncate" title={doc.originalName}>
                                  {doc.documentType || "Berkas"}
                                </span>
                                <ExternalLink className="h-3 w-3 text-neutral-400" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-500">
                            Belum unggah berkas
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && pagination.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-3.5 sm:flex-row">
            <p className="text-xs text-neutral-500">
              Menampilkan <span className="font-semibold text-neutral-900">{(pagination.page - 1) * pagination.limit + 1}</span> sampai{" "}
              <span className="font-semibold text-neutral-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              dari <span className="font-semibold text-neutral-900">{pagination.total}</span> pengguna
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrev}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Sebelumnya
              </button>

              <span className="px-2 text-xs font-semibold text-neutral-700">
                Halaman {pagination.page} / {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={!pagination.hasNext}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
              >
                Berikutnya
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah Petugas Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => !isPending && setIsModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Tambah Akun Petugas</h3>
                  <p className="text-xs text-neutral-500">Buat akses portal petugas operasional bank sampah</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreatePetugas} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nama Lengkap Petugas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Alamat Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="petugas@banksampah.id"
                  className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Kata Sandi Sementara <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Nomor Telepon</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Alamat Domisili</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Kota / Wilayah tugas"
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Petugas</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
