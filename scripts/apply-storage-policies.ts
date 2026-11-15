import { prisma } from "../lib/prisma";

async function main() {
  try {
    console.log("Applying Storage RLS policies...");
    
    // Buckets SELECT policy
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'buckets' AND policyname = 'Allow public and anon read buckets'
        ) THEN
          CREATE POLICY "Allow public and anon read buckets"
          ON storage.buckets FOR SELECT
          TO anon, authenticated, service_role
          USING (true);
        END IF;
      END $$;
    `);

    // Objects ALL policy for app buckets
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow storage access for catalog and private-documents'
        ) THEN
          CREATE POLICY "Allow storage access for catalog and private-documents"
          ON storage.objects FOR ALL
          TO anon, authenticated, service_role
          USING (bucket_id IN ('catalog', 'private-documents'))
          WITH CHECK (bucket_id IN ('catalog', 'private-documents'));
        END IF;
      END $$;
    `);

    console.log("Policies applied successfully!");
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
