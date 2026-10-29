# PROJECT CONTEXT: Sistem Informasi Pengelolaan Bank Sampah (Versi 4.0)
Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma ORM + Supabase Storage + Redis/BullMQ + Web Push + Pino.

1. ATURAN TIPE DATA & VALIDASI MULTI-LAPIS:
   - Semua kolom nominal uang/harga/saldo WAJIB menggunakan DECIMAL(15,2) dan berat sampah WAJIB DECIMAL(10,2). Dilarang menggunakan FLOAT.
   - Lapis 1: Frontend/UI validation pada form input.
   - Lapis 2: Skema validasi runtime menggunakan Zod pada endpoint API.
   - Lapis 3: Database CHECK Constraints pada PostgreSQL:
     * users: balance >= 0
     * user_documents: size_bytes > 0 AND size_bytes <= 5242880 (maks 5MB)
     * waste_categories: current_price_per_kg > 0
     * deposits: total_weight_kg > 0 AND total_amount > 0
     * deposit_items: weight_kg > 0 AND price_per_kg_snapshot > 0 AND subtotal > 0
     * withdrawals: amount > 0
     * balance_mutations: amount > 0 AND balance_after >= 0

2. SKEMA 8 TABEL TERKUNCI (v4.0):
   - users: id, name, email, password_hash, phone, address, role ('nasabah'|'petugas'|'admin'), balance, created_at, updated_at
   - user_documents: id, user_id, document_type ('KTP'|'BERKAS_PENDAFTARAN'|'CV'), original_name, storage_bucket (default: "private-documents"), storage_object_key, mime_type, size_bytes, created_at, updated_at
   - waste_categories: id, code, name, unit, current_price_per_kg, public_image_url, is_active, created_at, updated_at
   - deposits: id, transaction_code, nasabah_id, petugas_id, total_weight_kg, total_amount, status, deposit_date, created_at, updated_at (Index: [nasabah_id, deposit_date(sort: Desc)])
   - deposit_items: id, deposit_id, waste_category_id, weight_kg, price_per_kg_snapshot, subtotal
   - withdrawals: id, withdrawal_code, nasabah_id, amount, status ('PENDING'|'APPROVED'|'REJECTED'), approved_by, rejection_reason, requested_at, processed_at (Index: [status, requested_at(sort: Desc)])
   - balance_mutations: id, user_id, reference_type, reference_id, mutation_type ('CREDIT'|'DEBIT'), amount, balance_before, balance_after, created_at
   - push_subscriptions: id, user_id, endpoint (unique), p256dh_key, auth_key, user_agent, is_active, created_at, updated_at

3. ATURAN SNAPSHOT HARGA: Saat menyimpan setoran ke deposit_items, WAJIB menyalin waste_categories.current_price_per_kg ke deposit_items.price_per_kg_snapshot. Tampilan riwayat setoran WAJIB membaca price_per_kg_snapshot.

4. ATURAN KEAMANAN BERKAS & SUPABASE STORAGE:
   - Foto katalog sampah disimpan di Supabase Public Bucket (SUPABASE_PUBLIC_BUCKET="catalog").
   - Berkas KTP, pendaftaran, dan CV disimpan di Supabase Private Bucket (SUPABASE_PRIVATE_BUCKET="private-documents") dan hanya diakses via endpoint /documents/[id]/view.
   - Jika (auth.id !== doc.user_id && auth.role !== 'admin'), WAJIB return HTTP 403 Forbidden. Akses yang sah diberikan via Signed URL berbatas waktu atau file proxy stream.

5. ATURAN SALDO & PENARIKAN: Penambahan/pengurangan saldo wajib memakai Database Transaction. Pengajuan penarikan WAJIB ditolak jika amount > (users.balance - pending_withdrawals).

6. OBSERVABILITAS & KEAMANAN:
   - Structured logging menggunakan Pino (`lib/logger.ts`) dengan auto-redaction pada data sensitif (password, password_hash, token, cookie, VAPID_PRIVATE_KEY).
   - In-memory / Redis rate limiting (`lib/ratelimit.ts`) untuk mitigasi abuse (HTTP 429 Too Many Requests).
   - Antrean asinkronus menggunakan BullMQ + Redis untuk pengiriman Web Push Notifications.

7. KONFIGURASI ENV:
   - DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_PUBLIC_BUCKET="catalog", SUPABASE_PRIVATE_BUCKET="private-documents"
   - JWT_SECRET, NEXT_PUBLIC_APP_URL, REDIS_URL
   - VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, LOG_LEVEL="info"
