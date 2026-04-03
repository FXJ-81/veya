-- AlterTable
ALTER TABLE "UserSettings"
  ADD COLUMN "renewalReminders" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "budgetAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "newSubDetected" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "priceAlerts" BOOLEAN NOT NULL DEFAULT true;
