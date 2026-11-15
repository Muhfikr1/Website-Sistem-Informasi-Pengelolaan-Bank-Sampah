"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Banknote,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Check,
  X,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { formatRupiah } from "@/lib/ui-format";

interface WithdrawalItem {
  id: string;
  withdrawalCode: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  nasabah: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    balance: number;
  };
  approver: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface SummaryData {
  totalPending: number;
  totalApproved: number;
  totalApprovedAmount: number;
  totalRejected: number;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalPending: 0,
    totalApproved: 0,
    totalApprovedAmount: 0,
    totalRejected: 0,
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null);
  const [modalAction, setModalAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounce search input (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch data penarikan dari API
  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          status: statusFilter,
          page: String(currentPage),
          limit: "10",
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        const res = await fetch(`/api/admin/withdrawals?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || `Gagal memuat data (HTTP ${res.status})`);
        }

        const data = await res.json();
        if (!ignore) {
          setItems(data.items || []);
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
          setError(e.message || "Terjadi kesalahan saat memuat data penarikan saldo.");
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
  }, [statusFilter, debouncedSearch, currentPage]);

  const refreshData = () => {
    setCurrentPage(1);
    setSearchInput("");
  };

  const closeModal = () => {
    setSelectedWithdrawal(null);
    setModalAction(null);
    setRejectionReason("");
    setActionError(null);
    setActionSuccess(null);
  };

  const openApproveModal = (w: WithdrawalItem) => {
    setSelectedWithdrawal(w);
    setModalAction("APPROVE");
    setActionError(null);
    setActionSuccess(null);
  };

  const openRejectModal = (w: WithdrawalItem) => {
    setSelectedWithdrawal(w);
    setModalAction("REJECT");
    setRejectionReason("");
    setActionError(null);
    setActionSuccess(null);
  };

  // Tutup Modal dengan tombol Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalAction && !isPending) {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalAction, isPending]);

  // Handle proses Setujui / Tolak
  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawal || !modalAction) return;

    setActionError(null);
    setActionSuccess(null);

    if (modalAction === "REJECT" && rejectionReason.trim().length < 5) {
      setActionError("Alasan penolakan wajib diisi minimal 5 karakter.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/withdrawals/${selectedWithdrawal.id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: modalAction,
            rejectionReason: modalAction === "REJECT" ? rejectionReason.trim() : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Gagal memproses pengajuan penarikan.");
        }

        setActionSuccess(data.message || "Berhasil memproses pengajuan.");

        // Refresh tabel
        setTimeout(() => {
          closeModal();
          setCurrentPage(1);
          // trigger reload
          setStatusFilter((prev) => prev);
        }, 1200);
      } catch (err: unknown) {
        const e = err as Error;
        setActionError(e.message || "Terjadi kesalahan internal saat memproses.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Persetujuan & Penolakan Penarikan Saldo
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Validasi pengajuan penarikan saldo nasabah dengan eksekusi atomik mutasi debit dan notifikasi instan.
        </p>
      </div>

      {/* 4 Kartu Ringkasan (Top Summary Metrics) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Menunggu Persetujuan</p>
              <h3 className="text-2xl font-extrabold text-amber-950">{summary.totalPending}</h3>
            </div>
          </div>
        </div>

        {/* Total Disetujui (Nominal) */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Dana Disetujui</p>
              <h3 className="text-xl font-extrabold text-emerald-950">
                {formatRupiah(summary.totalApprovedAmount)}
              </h3>
            </div>
          </div>
        </div>

        {/* Jumlah Disetujui */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Jumlah Disetujui</p>
              <h3 className="text-2xl font-extrabold text-neutral-900">{summary.totalApproved}</h3>
            </div>
          </div>
        </div>

        {/* Jumlah Ditolak */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <XCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Jumlah Ditolak</p>
              <h3 className="text-2xl font-extrabold text-neutral-900">{summary.totalRejected}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Kontrol Filter & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab Filter Status */}
        <div className="flex flex-wrap rounded-xl bg-neutral-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ALL");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 transition-all ${
              statusFilter === "ALL"
                ? "bg-white text-neutral-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("PENDING");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 transition-all ${
              statusFilter === "PENDING"
                ? "bg-white text-amber-900 shadow-2xs font-bold"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Menunggu ({summary.totalPending})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("APPROVED");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 transition-all ${
              statusFilter === "APPROVED"
                ? "bg-white text-emerald-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Disetujui
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("REJECTED");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 transition-all ${
              statusFilter === "REJECTED"
                ? "bg-white text-red-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Ditolak
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari kode atau nasabah..."
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
      {error && <ErrorAlert title="Gagal memuat penarikan" message={error} onRetry={refreshData} />}

      {/* Tabel Data Penarikan */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="border-b border-neutral-100 bg-neutral-50/70 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th scope="col" className="px-5 py-3.5">Kode & Tanggal</th>
                <th scope="col" className="px-5 py-3.5">Nasabah</th>
                <th scope="col" className="px-5 py-3.5">Nominal Penarikan</th>
                <th scope="col" className="px-5 py-3.5">Status</th>
                <th scope="col" className="px-5 py-3.5">Keterangan / Petugas</th>
                <th scope="col" className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                // Skeleton loading state
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-4 w-28 rounded bg-neutral-200 mb-2"></div>
                      <div className="h-3 w-36 rounded bg-neutral-100"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-32 rounded bg-neutral-200 mb-1"></div>
                      <div className="h-3 w-20 rounded bg-neutral-100"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-5 w-24 rounded bg-neutral-200"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-6 w-20 rounded-full bg-neutral-200"></div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-3 w-36 rounded bg-neutral-200"></div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="h-8 w-24 rounded-lg bg-neutral-200 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8">
                    <EmptyState
                      icon={Banknote}
                      title="Tidak ada riwayat penarikan"
                      description={
                        debouncedSearch
                          ? `Tidak ditemukan penarikan yang cocok dengan "${debouncedSearch}".`
                          : "Belum ada pengajuan penarikan saldo pada filter ini."
                      }
                    />
                  </td>
                </tr>
              ) : (
                items.map((w) => {
                  return (
                    <tr key={w.id} className="hover:bg-neutral-50/80 transition-colors">
                      {/* 1. Kode & Tanggal */}
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-neutral-900">{w.withdrawalCode}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(w.requestedAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* 2. Nasabah & Saldo Saat Ini */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-neutral-900">{w.nasabah.name}</div>
                        <div className="text-xs text-neutral-500">{w.nasabah.email}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400">
                          <span>Saldo akun:</span>
                          <span className="font-semibold text-neutral-700">
                            {formatRupiah(w.nasabah.balance)}
                          </span>
                        </div>
                      </td>

                      {/* 3. Nominal Penarikan */}
                      <td className="px-5 py-4">
                        <span className="text-base font-extrabold text-neutral-900">
                          {formatRupiah(w.amount)}
                        </span>
                        {w.nasabah.balance < w.amount && w.status === "PENDING" && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">
                            <AlertTriangle className="h-3 w-3" />
                            Saldo kurang!
                          </div>
                        )}
                      </td>

                      {/* 4. Status Badge */}
                      <td className="px-5 py-4">
                        {w.status === "PENDING" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            Menunggu
                          </span>
                        )}
                        {w.status === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Disetujui
                          </span>
                        )}
                        {w.status === "REJECTED" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800">
                            <XCircle className="h-3.5 w-3.5 text-red-600" />
                            Ditolak
                          </span>
                        )}
                      </td>

                      {/* 5. Keterangan / Approver */}
                      <td className="px-5 py-4 max-w-xs">
                        {w.status === "REJECTED" && w.rejectionReason && (
                          <div className="text-xs text-red-700 bg-red-50/60 p-2 rounded-lg border border-red-100">
                            <span className="font-semibold block">Alasan Penolakan:</span>
                            <span className="line-clamp-2">{w.rejectionReason}</span>
                          </div>
                        )}
                        {w.approver && (
                          <div className="text-xs text-neutral-500 mt-1">
                            <span>Diproses oleh: </span>
                            <strong className="text-neutral-700">{w.approver.name}</strong>
                          </div>
                        )}
                        {w.status === "PENDING" && (
                          <span className="text-xs text-neutral-400 italic">Menunggu verifikasi admin</span>
                        )}
                      </td>

                      {/* 6. Aksi (Setujui / Tolak) */}
                      <td className="px-5 py-4 text-right">
                        {w.status === "PENDING" ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openApproveModal(w)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Setujui</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openRejectModal(w)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-2xs transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">Selesai</span>
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
              Menampilkan{" "}
              <span className="font-semibold text-neutral-900">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              sampai{" "}
              <span className="font-semibold text-neutral-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              dari <span className="font-semibold text-neutral-900">{pagination.total}</span> pengajuan
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

      {/* Modal Konfirmasi Persetujuan (APPROVE) */}
      {modalAction === "APPROVE" && selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => !isPending && closeModal()}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Konfirmasi Persetujuan</h3>
                  <p className="text-xs text-neutral-500">Mutasi saldo debit nasabah akan segera diproses</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={closeModal}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{actionSuccess}</span>
              </div>
            )}

            <div className="mt-4 space-y-3 rounded-xl bg-neutral-50 p-4 border border-neutral-200 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Kode Pengajuan:</span>
                <span className="font-mono font-bold text-neutral-900">{selectedWithdrawal.withdrawalCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Nama Nasabah:</span>
                <span className="font-semibold text-neutral-900">{selectedWithdrawal.nasabah.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Saldo Nasabah Saat Ini:</span>
                <span className="font-bold text-neutral-900">{formatRupiah(selectedWithdrawal.nasabah.balance)}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base">
                <span className="font-semibold text-neutral-700">Nominal Penarikan:</span>
                <span className="font-extrabold text-emerald-700">{formatRupiah(selectedWithdrawal.amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Estimasi Sisa Saldo:</span>
                <span className="font-semibold text-neutral-800">
                  {formatRupiah(Math.max(0, selectedWithdrawal.nasabah.balance - selectedWithdrawal.amount))}
                </span>
              </div>
            </div>

            {selectedWithdrawal.nasabah.balance < selectedWithdrawal.amount && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Perhatian: Saldo nasabah saat ini tidak mencukupi untuk penarikan ini. Transaksi akan otomatis ditolak oleh database.
                </span>
              </div>
            )}

            <form onSubmit={handleProcess} className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                disabled={isPending}
                onClick={closeModal}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-2xs disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Ya, Setujui Penarikan</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Input Alasan Penolakan (REJECT) */}
      {modalAction === "REJECT" && selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => !isPending && closeModal()}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-700">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Tolak Pengajuan Penarikan</h3>
                  <p className="text-xs text-neutral-500">Saldo nasabah tidak akan dikurangi</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={closeModal}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{actionSuccess}</span>
              </div>
            )}

            <div className="mt-4 space-y-2 rounded-xl bg-neutral-50 p-4 border border-neutral-200 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Kode:</span>
                <span className="font-mono font-bold text-neutral-900">{selectedWithdrawal.withdrawalCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Nasabah:</span>
                <span className="font-semibold text-neutral-900">{selectedWithdrawal.nasabah.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Nominal:</span>
                <span className="font-bold text-neutral-900">{formatRupiah(selectedWithdrawal.amount)}</span>
              </div>
            </div>

            <form onSubmit={handleProcess} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Saldo tidak mencukupi, rekening bank tidak valid, atau permintaan dibatalkan nasabah."
                  className="w-full rounded-xl border border-neutral-200 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <p className="mt-1 text-[11px] text-neutral-400">Minimal 5 karakter. Alasan ini akan dikirim ke notifikasi nasabah.</p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={closeModal}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-sm font-semibold text-white shadow-2xs disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Tolak Pengajuan</span>
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
