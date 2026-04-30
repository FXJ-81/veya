import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AccentPreference } from "@/lib/accentPreference";

/**
 * Read/write `UserSettings.accentPreference` via raw SQL so PATCH/GET work even when
 * the installed `@prisma/client` predates the `accentPreference` column (stale generate).
 * Prefer `prisma generate` after schema changes; this keeps the API aligned with the DB.
 */
export async function readAccentPreferenceFromDb(
  prisma: PrismaClient,
  userId: string,
): Promise<AccentPreference | null> {
  const rows = await prisma.$queryRaw<{ accentPreference: string }[]>(
    Prisma.sql`SELECT "accentPreference" FROM "UserSettings" WHERE "userId" = ${userId} LIMIT 1`,
  );
  const raw = rows[0]?.accentPreference;
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v === "white") return "white";
  if (v === "brand") return "brand";
  // Empty / unknown values → treat as unset → caller defaults to Veya dark (brand).
  return null;
}

export async function writeAccentPreferenceToDb(
  prisma: PrismaClient,
  userId: string,
  value: AccentPreference,
): Promise<number> {
  return prisma.$executeRaw(
    Prisma.sql`UPDATE "UserSettings" SET "accentPreference" = ${value} WHERE "userId" = ${userId}`,
  );
}
