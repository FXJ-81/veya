import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type UpcomingPriceRow = {
  id: string;
  upcomingPrice: number | null;
  upcomingPriceEffectiveAt: Date | null;
};

export async function readUpcomingPriceRowsForUser(
  prisma: PrismaClient,
  userId: string,
  subscriptionIds?: string[],
): Promise<UpcomingPriceRow[]> {
  if (subscriptionIds && subscriptionIds.length === 0) return [];
  if (subscriptionIds && subscriptionIds.length > 0) {
    const rows = await prisma.$queryRaw<UpcomingPriceRow[]>(
      Prisma.sql`
        SELECT "id", "upcomingPrice", "upcomingPriceEffectiveAt"
        FROM "Subscription"
        WHERE "userId" = ${userId} AND "id" IN (${Prisma.join(subscriptionIds)})
      `,
    );
    return rows ?? [];
  }

  const rows = await prisma.$queryRaw<UpcomingPriceRow[]>(
    Prisma.sql`
      SELECT "id", "upcomingPrice", "upcomingPriceEffectiveAt"
      FROM "Subscription"
      WHERE "userId" = ${userId}
    `,
  );
  return rows ?? [];
}

export function upcomingPriceMap(rows: UpcomingPriceRow[]): Map<string, UpcomingPriceRow> {
  const map = new Map<string, UpcomingPriceRow>();
  for (const r of rows) map.set(r.id, r);
  return map;
}

export async function writeUpcomingPriceForUserSubscription(
  prisma: PrismaClient,
  params: {
    userId: string;
    subscriptionId: string;
    upcomingPrice: number | null;
    upcomingPriceEffectiveAt: Date | null;
  },
): Promise<number> {
  const { userId, subscriptionId, upcomingPrice, upcomingPriceEffectiveAt } = params;
  return prisma.$executeRaw(
    Prisma.sql`
      UPDATE "Subscription"
      SET "upcomingPrice" = ${upcomingPrice}, "upcomingPriceEffectiveAt" = ${upcomingPriceEffectiveAt}
      WHERE "id" = ${subscriptionId} AND "userId" = ${userId}
    `,
  );
}

