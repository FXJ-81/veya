CREATE TABLE "PlaidSubscriptionCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "normalizedMerchantKey" TEXT NOT NULL,
    "matchKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "lastCharged" TIMESTAMP(3) NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaidSubscriptionCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaidSubscriptionCandidate_userId_normalizedMerchantKey_key"
ON "PlaidSubscriptionCandidate"("userId", "normalizedMerchantKey");

CREATE INDEX "PlaidSubscriptionCandidate_userId_status_idx"
ON "PlaidSubscriptionCandidate"("userId", "status");

ALTER TABLE "PlaidSubscriptionCandidate"
ADD CONSTRAINT "PlaidSubscriptionCandidate_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
