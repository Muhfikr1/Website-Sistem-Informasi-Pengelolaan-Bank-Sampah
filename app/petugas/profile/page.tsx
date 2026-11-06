import { redirect } from "next/navigation";
import { ExternalLink, FileText, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatFileSize } from "@/lib/upload-rules";
import CvUploadForm from "./CvUploadForm";

export const metadata = { title: "Profil & CV" };

export default async function PetugasProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, cv] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, email: true, phone: true, address: true, created_at: true },
    }),
    prisma.userDocument.findFirst({
      where: { user_id: session.id, document_type: "CV" },
      orderBy: { created_at: "desc" },
    }),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl space-y-6">
      <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
          <UserRound className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-bold">Profil Petugas</h1>
        </div>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">Nama</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Telepon</dt>
            <dd className="font-medium">{user.phone || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Terdaftar sejak</dt>
            <dd className="font-medium">
              {user.created_at.toLocaleDateString("id-ID", { dateStyle: "long" })}
            </dd>
          </div>
        </dl>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
          <FileText className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold">Curriculum Vitae (CV)</h2>
        </div>

        <div className="mt-4">
          {cv ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-teal-950">{cv.original_name}</p>
                <p className="text-xs text-neutral-600">
                  {formatFileSize(cv.size_bytes)} · diunggah{" "}
                  {cv.created_at.toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </p>
              </div>
              <a
                href={`/documents/${cv.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Lihat CV
              </a>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
              Belum ada CV. Unggah CV Anda lewat formulir di bawah.
            </p>
          )}
        </div>

        <div className="mt-6">
          <CvUploadForm hasCv={Boolean(cv)} />
        </div>
      </section>
    </div>
  );
}