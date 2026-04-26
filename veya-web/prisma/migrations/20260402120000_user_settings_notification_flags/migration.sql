-- Restore missing historical migration directory.
-- These changes are written idempotently because the target database already has
-- the columns from earlier schema pushes.

ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "notificationPrefs" JSONB;

ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "budgetLimit" DOUBLE PRECISION;

ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "gmailFirstScanCompletedAt" TIMESTAMP(3);

ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "lastGmailScanAt" TIMESTAMP(3);

ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "lastGmailScanFoundCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "plaidDeclinedMerchantKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
