# PROJECT CONTEXT: Sistem Informasi Pengelolaan Bank Sampah
Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma ORM.

1. ATURAN TIPE DATA: Semua kolom nominal uang/harga/saldo WAJIB menggunakan DECIMAL(15,2) dan berat sampah WAJIB DECIMAL(10,2). Dilarang menggunakan FLOAT.
2. SKEMA 7 TABEL TERKUNCI:
   - users: id, name, email, password_hash, phone, address, role ('nasabah'|'petugas'|'admin'), balance
   - user_documents: id, user_id, document_type ('KTP'|'BERKAS_PENDAFTARAN'|'CV'), original_name, private_file_path, mime_type
   - waste_categories: id, code, name, unit, current_price_per_kg, public_image_path, is_active
   - deposits: id, transaction_code, nasabah_id, petugas_id, total_weight_kg, total_amount, status, deposit_date
   - deposit_items: id, deposit_id, waste_category_id, weight_kg, price_per_kg_snapshot, subtotal
   - withdrawals: id, withdrawal_code, nasabah_id, amount, status ('PENDING'|'APPROVED'|'REJECTED'), approved_by, rejection_reason, requested_at, processed_at
   - balance_mutations: id, user_id, reference_type, reference_id, mutation_type ('CREDIT'|'DEBIT'), amount, balance_before, balance_after
3. ATURAN SNAPSHOT HARGA: Saat menyimpan setoran ke deposit_items, WAJIB menyalin waste_categories.current_price_per_kg ke deposit_items.price_per_kg_snapshot. Tampilan riwayat setoran WAJIB membaca price_per_kg_snapshot.
4. ATURAN KEAMANAN BERKAS: Foto katalog sampah disimpan di folder publik (/public/storage/catalog/). Berkas KTP, pendaftaran, dan CV disimpan di folder privat (/storage/private/documents/) dan hanya diakses via endpoint /documents/[id]/view. Jika (auth.id !== doc.user_id && auth.role !== 'admin'), WAJIB return HTTP 403 Forbidden.
5. ATURAN SALDO & PENARIKAN: Penambahan/pengurangan saldo wajib memakai Database Transaction. Pengajuan penarikan WAJIB ditolak jika amount > (users.balance - pending_withdrawals).
