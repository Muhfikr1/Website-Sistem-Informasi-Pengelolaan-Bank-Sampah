import { formatRupiah } from "@/lib/ui-format";
import type { DepositRow, MutationRow, Paginated } from "@/lib/nasabah-queries";
import Pagination from "./Pagination";

type Keep = Record<string, string | number | undefined>;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKg(value: number) {
  return value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DepositHistory({ data, keep }: { data: Paginated<DepositRow>; keep: Keep }) {
  return (
    <section aria-labelledby="deposit-history" className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 id="deposit-history" className="text-lg font-bold text-neutral-900">Riwayat Setoran Sampah</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Harga per kg adalah harga yang dikunci saat setoran terjadi, bukan harga hari ini.
      </p>

      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
          Belum ada setoran pada rentang tanggal ini.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((d) => (
            <li key={d.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-neutral-500">{d.transactionCode}</p>
                  <p className="text-xs text-neutral-500">{formatDateTime(d.date)}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-700">+ {formatRupiah(d.totalAmount)}</p>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Rincian setoran {d.transactionCode}</caption>
                  <thead className="text-neutral-500">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-medium">Jenis</th>
                      <th scope="col" className="py-1 pr-3 font-medium">Berat</th>
                      <th scope="col" className="py-1 pr-3 font-medium">Harga/kg (terkunci)</th>
                      <th scope="col" className="py-1 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((i, idx) => (
                      <tr key={idx} className="border-t border-neutral-100">
                        <td className="py-1.5 pr-3">{i.name}</td>
                        <td className="py-1.5 pr-3">{formatKg(i.weightKg)} kg</td>
                        <td className="py-1.5 pr-3">{formatRupiah(i.priceSnapshot)}</td>
                        <td className="py-1.5 text-right">{formatRupiah(i.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-right text-xs text-neutral-500">Total berat {formatKg(d.totalWeightKg)} kg</p>
            </li>
          ))}
        </ul>
      )}
      <Pagination pageParam="dpage" page={data.page} totalPages={data.totalPages} keep={keep} />
    </section>
  );
}

const REFERENCE_LABEL: Record<string, string> = {
  DEPOSIT: "Setoran sampah",
  WITHDRAWAL: "Penarikan saldo",
};

export function MutationHistory({ data, keep }: { data: Paginated<MutationRow>; keep: Keep }) {
  return (
    <section aria-labelledby="mutation-history" className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 id="mutation-history" className="text-lg font-bold text-neutral-900">Riwayat Mutasi Saldo</h2>
      <p className="mb-4 text-xs text-neutral-500">Catatan setiap saldo bertambah (kredit) atau berkurang (debit).</p>

      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
          Belum ada mutasi saldo pada rentang tanggal ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Daftar mutasi saldo</caption>
            <thead className="text-neutral-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Waktu</th>
                <th scope="col" className="py-2 pr-3 font-medium">Keterangan</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Jumlah</th>
                <th scope="col" className="py-2 text-right font-medium">Saldo setelahnya</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100">
                  <td className="py-2 pr-3">{formatDateTime(m.date)}</td>
                  <td className="py-2 pr-3">{REFERENCE_LABEL[m.referenceType] ?? m.referenceType}</td>
                  <td className={`py-2 pr-3 text-right font-semibold ${m.type === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>
                    {m.type === "CREDIT" ? "+" : "−"} {formatRupiah(m.amount)}
                  </td>
                  <td className="py-2 text-right">{formatRupiah(m.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pageParam="mpage" page={data.page} totalPages={data.totalPages} keep={keep} />
    </section>
  );
}