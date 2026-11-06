import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Mail,
  MapPin,
  Phone,
  Recycle,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import PublicNavbar from "@/components/layout/PublicNavbar";
import Footer from "@/components/layout/Footer";
import EmptyState from "@/components/ui/EmptyState";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { siteConfig } from "@/lib/site-config";
import { formatRupiah } from "@/lib/ui-format";

// Data katalog harus selalu terbaru dari database
export const dynamic = "force-dynamic";

interface CatalogItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  imageUrl: string | null;
}

async function getCatalog(): Promise<{ items: CatalogItem[]; failed: boolean }> {
  try {
    const rows = await prisma.wasteCategory.findMany({
      where: { is_active: true },
      orderBy: { code: "asc" },
    });
    return {
      failed: false,
      items: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        unit: r.unit,
        price: r.current_price_per_kg.toNumber(),
        imageUrl: r.public_image_url,
      })),
    };
  } catch (error) {
    logger.error({ error, context: "API", operation: "landing.getCatalog" }, "Gagal memuat katalog sampah");
    return { items: [], failed: true };
  }
}

function SectionHeading({ id, eyebrow, title, desc }: { id: string; eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
        {title}
      </h2>
      {desc && <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">{desc}</p>}
    </div>
  );
}

export default async function Home() {
  const { items, failed } = await getCatalog();
  const { profile, procedure, schedule, location } = siteConfig;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(location.mapQuery)}&output=embed`;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/70 via-white to-neutral-50 text-neutral-900">
      <PublicNavbar />

      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* 1. PROFIL + 7. TOMBOL DAFTAR (hero) */}
        <section aria-labelledby="profil" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/70 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Profil Bank Sampah
              </span>
              <h1 id="profil" className="mt-5 text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl">
                {profile.headline}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
                {profile.summary}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Daftar Nasabah</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="#katalog"
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 py-3.5 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
                >
                  Lihat Harga Sampah
                </Link>
              </div>
            </div>

            <ul className="space-y-3">
              {profile.highlights.map((text) => (
                <li
                  key={text}
                  className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Recycle className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm leading-relaxed text-neutral-700">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 2. JENIS SAMPAH + 3. HARGA PER KG (dari database + Supabase bucket 'catalog') */}
        <section id="katalog" aria-labelledby="katalog-title" className="scroll-mt-20 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              id="katalog-title"
              eyebrow="Jenis Sampah & Harga"
              title="Sampah yang Kami Terima"
              desc="Harga per kilogram diperbarui admin dan selalu tampil sesuai data terbaru."
            />

            {failed ? (
              <ErrorAlert
                title="Katalog gagal dimuat"
                message="Kami belum bisa mengambil daftar jenis sampah. Muat ulang halaman beberapa saat lagi."
              />
            ) : items.length === 0 ? (
              <EmptyState
                title="Belum ada jenis sampah aktif"
                description="Daftar jenis sampah akan tampil di sini setelah admin menambahkannya."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="aspect-[4/3] w-full bg-emerald-50">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={`Foto ${item.name}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-emerald-300">
                          <Recycle className="h-12 w-12" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="font-mono text-[11px] font-semibold text-neutral-400">{item.code}</p>
                      <h3 className="mt-0.5 text-base font-bold text-neutral-900">{item.name}</h3>
                      <p className="mt-3 text-2xl font-black text-emerald-700">
                        {formatRupiah(item.price)}
                        <span className="ml-1 text-sm font-medium text-neutral-500">/ {item.unit}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 4. PROSEDUR SETORAN */}
        <section id="prosedur" aria-labelledby="prosedur-title" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              id="prosedur-title"
              eyebrow="Prosedur Setoran"
              title="Cara Menyetor Sampah"
              desc="Lima langkah mudah dari pendaftaran hingga saldo masuk ke akun Anda."
            />
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {procedure.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-neutral-900">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. JADWAL OPERASIONAL + 6. LOKASI */}
        <section aria-label="Jadwal dan lokasi" className="bg-white py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <section id="jadwal" aria-labelledby="jadwal-title" className="scroll-mt-20">
              <SectionHeading id="jadwal-title" eyebrow="Jadwal Operasional" title="Jam Layanan" />
              <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                {schedule.map((row) => (
                  <li key={row.day} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="flex items-center gap-2.5 text-sm font-semibold text-neutral-800">
                      <CalendarClock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      {row.day}
                    </span>
                    <span
                      className={`flex items-center gap-1.5 text-sm font-medium ${row.open ? "text-neutral-700" : "text-red-600"
                        }`}
                    >
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {row.hours}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="lokasi" aria-labelledby="lokasi-title" className="scroll-mt-20">
              <SectionHeading id="lokasi-title" eyebrow="Lokasi" title="Temukan Kami" />
              <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
                <iframe
                  title={`Peta lokasi ${location.placeName}`}
                  src={mapSrc}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-64 w-full border-0"
                />
              </div>
              <address className="mt-4 space-y-2 text-sm not-italic text-neutral-700">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>
                    <strong>{location.placeName}</strong>
                    <br />
                    {location.address}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  {location.phone}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  {location.email}
                </p>
              </address>
            </section>
          </div>
        </section>

        {/* 7. TOMBOL DAFTAR NASABAH (CTA penutup) */}
        <section aria-label="Ajakan mendaftar" className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-3xl bg-emerald-600 px-6 py-12 text-center text-white shadow-xl shadow-emerald-600/20">
            <h2 className="text-2xl font-black sm:text-3xl">Siap Mulai Menabung Sampah?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-emerald-50 sm:text-base">
              Daftar sebagai nasabah, unggah KTP Anda, dan mulai kumpulkan saldo dari sampah yang dipilah.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-emerald-700 shadow hover:bg-emerald-50"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Daftar Nasabah Sekarang
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}