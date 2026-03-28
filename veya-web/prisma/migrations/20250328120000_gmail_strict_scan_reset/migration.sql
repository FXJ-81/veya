-- Add Gmail source tracking and first-scan flag (idempotent if columns already exist from db push)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "hasAutoScanned" BOOLEAN NOT NULL DEFAULT false;

-- Mark legacy Gmail imports, remove them, and force a fresh strict scan for everyone
UPDATE "Subscription" SET "source" = 'gmail' WHERE "notes" = 'Found via Gmail scan';
DELETE FROM "Subscription" WHERE "source" = 'gmail';
UPDATE "UserSettings" SET "hasAutoScanned" = false;
