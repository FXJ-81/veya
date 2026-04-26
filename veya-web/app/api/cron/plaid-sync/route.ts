import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPlaidSubscriptionSyncForUser } from "@/lib/runPlaidSubscriptionSync";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron (see `vercel.json`).
 *
 * Secured with `Authorization: Bearer <CRON_SECRET>` so random clients cannot trigger syncs.
 * Iterates every user with at least one Plaid account and refreshes pending bank review
 * candidates without auto-adding subscriptions.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { plaidAccounts: { some: {} } },
    select: { id: true },
  });

  let processed = 0;
  let failures = 0;
  let totalPendingCreated = 0;
  let totalPendingUpdated = 0;

  for (const { id } of users) {
    try {
      const r = await runPlaidSubscriptionSyncForUser(id, { mode: "store_pending" });
      if (r.ok) {
        processed++;
        totalPendingCreated += r.pendingCreated;
        totalPendingUpdated += r.pendingUpdated;
      } else {
        failures++;
      }
    } catch (e) {
      failures++;
      console.error("[cron/plaid-sync] user failed", id, e);
    }
  }

  console.log("[cron/plaid-sync] run complete", {
    users: users.length,
    processed,
    failures,
    totalPendingCreated,
    totalPendingUpdated,
  });

  return NextResponse.json({
    ok: true,
    usersWithPlaid: users.length,
    processedOk: processed,
    failures,
    totalPendingCreated,
    totalPendingUpdated,
  });
}
