import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPlaidSubscriptionSyncForUser } from "@/lib/runPlaidSubscriptionSync";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron (see `vercel.json`): runs about every 5 minutes.
 *
 * Secured with `Authorization: Bearer <CRON_SECRET>` so random clients cannot trigger syncs.
 * Iterates every user with at least one Plaid account and runs `silent_auto` (append new subs).
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
  let totalAutoImported = 0;

  for (const { id } of users) {
    try {
      const r = await runPlaidSubscriptionSyncForUser(id, { mode: "silent_auto" });
      if (r.ok) {
        processed++;
        totalAutoImported += r.autoImported;
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
    totalAutoImported,
  });

  return NextResponse.json({
    ok: true,
    usersWithPlaid: users.length,
    processedOk: processed,
    failures,
    totalAutoImported,
  });
}
