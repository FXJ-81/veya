CREATE TABLE "AiMessageUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMessageUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiMessageUsage_userId_day_key" ON "AiMessageUsage"("userId", "day");
CREATE INDEX "AiMessageUsage_userId_day_idx" ON "AiMessageUsage"("userId", "day");

ALTER TABLE "AiMessageUsage" ADD CONSTRAINT "AiMessageUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
