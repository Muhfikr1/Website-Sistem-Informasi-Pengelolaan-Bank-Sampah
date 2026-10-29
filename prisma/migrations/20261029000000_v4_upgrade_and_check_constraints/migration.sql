-- Migration Versi 4.0: Schema Upgrade & PostgreSQL CHECK Constraints (Validasi Lapis 3)

-- 1. Penyesuaian Kolom user_documents
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_documents' AND column_name = 'private_file_path'
    ) THEN
        ALTER TABLE "user_documents" ADD COLUMN IF NOT EXISTS "storage_bucket" TEXT NOT NULL DEFAULT 'private-documents';
        ALTER TABLE "user_documents" ADD COLUMN IF NOT EXISTS "storage_object_key" TEXT;
        ALTER TABLE "user_documents" ADD COLUMN IF NOT EXISTS "size_bytes" INTEGER DEFAULT 1024;
        
        UPDATE "user_documents" 
        SET "storage_object_key" = "private_file_path" 
        WHERE "storage_object_key" IS NULL;

        UPDATE "user_documents" 
        SET "size_bytes" = 1024 
        WHERE "size_bytes" IS NULL;

        ALTER TABLE "user_documents" ALTER COLUMN "storage_object_key" SET NOT NULL;
        ALTER TABLE "user_documents" ALTER COLUMN "size_bytes" SET NOT NULL;
        ALTER TABLE "user_documents" DROP COLUMN "private_file_path";
    ELSE
        ALTER TABLE "user_documents" ADD COLUMN IF NOT EXISTS "storage_bucket" TEXT NOT NULL DEFAULT 'private-documents';
        ALTER TABLE "user_documents" ADD COLUMN IF NOT EXISTS "storage_object_key" TEXT;
        ALTER TABLE "user_documents" ADD COLUMN IF NOT EXISTS "size_bytes" INTEGER;
    END IF;
END $$;

-- 2. Penyesuaian Kolom waste_categories
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waste_categories' AND column_name = 'public_image_path'
    ) THEN
        ALTER TABLE "waste_categories" RENAME COLUMN "public_image_path" TO "public_image_url";
    ELSE
        ALTER TABLE "waste_categories" ADD COLUMN IF NOT EXISTS "public_image_url" TEXT;
    END IF;
END $$;

-- 3. Pembuatan Tabel push_subscriptions (Model ke-8)
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh_key" TEXT NOT NULL,
    "auth_key" TEXT NOT NULL,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint"),
    CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Penambahan Indeks Kinerja
CREATE INDEX IF NOT EXISTS "deposits_nasabah_id_deposit_date_idx" ON "deposits"("nasabah_id", "deposit_date" DESC);
CREATE INDEX IF NOT EXISTS "withdrawals_status_requested_at_idx" ON "withdrawals"("status", "requested_at" DESC);

-- 5. PostgreSQL CHECK Constraints (Validasi Lapis 3)
-- users: balance non-negatif
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "check_users_balance_non_negative";
ALTER TABLE "users" ADD CONSTRAINT "check_users_balance_non_negative" CHECK ("balance" >= 0);

-- user_documents: size_bytes antara 1 byte s/d 5MB (5242880 bytes)
ALTER TABLE "user_documents" DROP CONSTRAINT IF EXISTS "check_user_documents_size_bytes";
ALTER TABLE "user_documents" ADD CONSTRAINT "check_user_documents_size_bytes" CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880);

-- waste_categories: harga terkini > 0
ALTER TABLE "waste_categories" DROP CONSTRAINT IF EXISTS "check_waste_categories_price_positive";
ALTER TABLE "waste_categories" ADD CONSTRAINT "check_waste_categories_price_positive" CHECK ("current_price_per_kg" > 0);

-- deposits: total berat dan nominal > 0
ALTER TABLE "deposits" DROP CONSTRAINT IF EXISTS "check_deposits_weight_and_amount_positive";
ALTER TABLE "deposits" ADD CONSTRAINT "check_deposits_weight_and_amount_positive" CHECK ("total_weight_kg" > 0 AND "total_amount" > 0);

-- deposit_items: berat, snapshot harga, dan subtotal > 0
ALTER TABLE "deposit_items" DROP CONSTRAINT IF EXISTS "check_deposit_items_values_positive";
ALTER TABLE "deposit_items" ADD CONSTRAINT "check_deposit_items_values_positive" CHECK ("weight_kg" > 0 AND "price_per_kg_snapshot" > 0 AND "subtotal" > 0);

-- withdrawals: nominal penarikan > 0
ALTER TABLE "withdrawals" DROP CONSTRAINT IF EXISTS "check_withdrawals_amount_positive";
ALTER TABLE "withdrawals" ADD CONSTRAINT "check_withdrawals_amount_positive" CHECK ("amount" > 0);

-- balance_mutations: mutasi > 0 dan saldo akhir non-negatif
ALTER TABLE "balance_mutations" DROP CONSTRAINT IF EXISTS "check_balance_mutations_positive_after";
ALTER TABLE "balance_mutations" ADD CONSTRAINT "check_balance_mutations_positive_after" CHECK ("amount" > 0 AND "balance_after" >= 0);

