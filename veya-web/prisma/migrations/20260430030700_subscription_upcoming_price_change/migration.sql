-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "upcomingPrice" DOUBLE PRECISION;
ALTER TABLE "Subscription" ADD COLUMN "upcomingPriceEffectiveAt" TIMESTAMP(3);

