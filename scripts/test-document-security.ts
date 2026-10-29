/**
 * Test script untuk memvalidasi logika keamanan otorisasi Dokumen Privat:
 * Aturan Otorisasi:
 * - auth.id === doc.user_id: Diizinkan (HTTP 200)
 * - auth.role === 'admin': Diizinkan (HTTP 200)
 * - auth.id !== doc.user_id && auth.role !== 'admin': DITOLAK (HTTP 403 Forbidden)
 * - unauthenticated (auth === null): DITOLAK (HTTP 403 Forbidden)
 */

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: 'nasabah' | 'petugas' | 'admin';
}

interface MockDocument {
  id: string;
  user_id: string;
  original_name: string;
  document_type: string;
  storage_bucket?: string;
  storage_object_key?: string;
  private_file_path?: string;
  mime_type: string;
  size_bytes?: number;
}

function checkDocumentAccess(
  session: MockUser | null,
  document: MockDocument | null
): { allowed: boolean; status: number; message: string } {
  if (!session) {
    return {
      allowed: false,
      status: 403,
      message: "403 Forbidden: Anda harus login untuk mengakses dokumen pribadi.",
    };
  }

  if (!document) {
    return {
      allowed: false,
      status: 404,
      message: "404 Not Found: Dokumen tidak ditemukan.",
    };
  }

  const isOwner = session.id === document.user_id;
  const isAdmin = session.role === "admin";

  if (!isOwner && !isAdmin) {
    return {
      allowed: false,
      status: 403,
      message:
        "403 FORBIDDEN - AKSES DOKUMEN PRIVAT DITOLAK. Pengguna tanpa hak tidak diizinkan membuka CV, berkas pendaftaran, atau dokumen pribadi milik pengguna lain.",
    };
  }

  return {
    allowed: true,
    status: 200,
    message: "200 OK: Akses diberikan.",
  };
}

console.log("=== MEMULAI PENGUJIAN KEAMANAN OTORISASI DOKUMEN PRIVAT ===");

const nasabahA: MockUser = { id: "user-uuid-1", name: "Nasabah A", email: "a@test.com", role: "nasabah" };
const nasabahB: MockUser = { id: "user-uuid-2", name: "Nasabah B", email: "b@test.com", role: "nasabah" };
const petugas: MockUser = { id: "petugas-uuid-3", name: "Petugas Lapangan", email: "p@test.com", role: "petugas" };
const admin: MockUser = { id: "admin-uuid-4", name: "Administrator", email: "admin@test.com", role: "admin" };

const docNasabahA: MockDocument = {
  id: "doc-uuid-1",
  user_id: "user-uuid-1",
  original_name: "ktp-nasabah-a.pdf",
  document_type: "KTP",
  private_file_path: "/storage/private/documents/ktp-a.pdf",
  mime_type: "application/pdf",
};

const docPetugasCV: MockDocument = {
  id: "doc-uuid-2",
  user_id: "petugas-uuid-3",
  original_name: "cv-petugas.pdf",
  document_type: "CV",
  private_file_path: "/storage/private/documents/cv-p.pdf",
  mime_type: "application/pdf",
};

// Test Case 1: Unauthenticated
const test1 = checkDocumentAccess(null, docNasabahA);
console.log(`\nTest 1 (Tanpa Sesi Login): Status ${test1.status} - ${test1.message}`);
if (test1.status === 403 && !test1.allowed) console.log("✔ LULUS: Tanpa login ditolak.");
else throw new Error("Gagal Test 1");

// Test Case 2: Pemilik Sah membuka dokumennya sendiri
const test2 = checkDocumentAccess(nasabahA, docNasabahA);
console.log(`\nTest 2 (Nasabah A buka KTP miliknya): Status ${test2.status} - ${test2.message}`);
if (test2.status === 200 && test2.allowed) console.log("✔ LULUS: Pemilik sah diizinkan.");
else throw new Error("Gagal Test 2");

// Test Case 3: Nasabah B membuka KTP milik Nasabah A
const test3 = checkDocumentAccess(nasabahB, docNasabahA);
console.log(`\nTest 3 (Nasabah B coba intip KTP Nasabah A): Status ${test3.status} - ${test3.message}`);
if (test3.status === 403 && !test3.allowed) console.log("✔ LULUS: Nasabah lain ditolak secara ketat dengan 403.");
else throw new Error("Gagal Test 3");

// Test Case 4: Nasabah A mencoba membuka CV milik Petugas
const test4 = checkDocumentAccess(nasabahA, docPetugasCV);
console.log(`\nTest 4 (Nasabah A coba intip CV Petugas): Status ${test4.status} - ${test4.message}`);
if (test4.status === 403 && !test4.allowed) console.log("✔ LULUS: Akses ke berkas privat petugas ditolak dengan 403.");
else throw new Error("Gagal Test 4");

// Test Case 5: Administrator membuka dokumen siapapun
const test5a = checkDocumentAccess(admin, docNasabahA);
const test5b = checkDocumentAccess(admin, docPetugasCV);
console.log(`\nTest 5 (Admin buka KTP Nasabah A): Status ${test5a.status} - ${test5a.message}`);
console.log(`Test 5 (Admin buka CV Petugas): Status ${test5b.status} - ${test5b.message}`);
if (test5a.status === 200 && test5b.status === 200) console.log("✔ LULUS: Admin memiliki hak ases membuka seluruh berkas privat.");
else throw new Error("Gagal Test 5");

console.log("\n============================================================");
console.log("SEMUA 5 KASUS UJI OTORISASI BERHASIL LOLOS 100%!");
