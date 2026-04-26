import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import {
  dismissPendingPlaidCandidatesByIds,
  listPendingPlaidCandidates,
  markPlaidCandidatesAddedByKeys,
  resolvePendingPlaidCandidatesByIds,
} from "@/lib/plaidCandidateState";
import { buildSubscriptionCreateFromPlaid } from "@/lib/plaidImportHelpers";
import { createSubscriptionForUser } from "@/lib/subscriptionCreateInternal";
import { subscriptionNameKeySet } from "@/lib/subscriptionDedup";
import { keysForPlaidMerchant } from "@/lib/plaidSyncCore";
import { prisma } from "@/lib/prisma";
import { planLimitResponse } from "@/lib/planLimits";

const patchSchema = z.object({
  action: z.enum(["add", "dismiss"]),
  ids: z.array(z.string().min(1)).min(1),
});

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const candidates = await listPendingPlaidCandidates(authUser.id);
  return NextResponse.json({ ok: true, candidates });
}

export async function PATCH(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { action, ids } = parsed.data;

  if (action === "dismiss") {
    const result = await dismissPendingPlaidCandidatesByIds(authUser.id, ids);
    console.log("[PATCH /api/plaid/pending-subscriptions]", {
      userId: authUser.id,
      action,
      requested: ids.length,
      dismissed: result.dismissed,
    });
    return NextResponse.json({ ok: true, dismissed: result.dismissed });
  }

  const rows = await resolvePendingPlaidCandidatesByIds(authUser.id, ids);
  const existingSubs = await prisma.subscription.findMany({
    where: { userId: authUser.id },
    select: { name: true },
  });
  const existingKeys = subscriptionNameKeySet(existingSubs);
  let added = 0;
  let skippedExisting = 0;
  for (const row of rows) {
    const keys = keysForPlaidMerchant({ name: row.name, merchantName: row.merchantName });
    if (keys.some((key) => existingKeys.has(key))) {
      await markPlaidCandidatesAddedByKeys(authUser.id, keys);
      skippedExisting++;
      continue;
    }
    const body = buildSubscriptionCreateFromPlaid({
      name: row.name,
      merchantName: row.merchantName,
      category: row.category,
      price: row.price,
      billingCycle: row.billingCycle as "monthly" | "yearly" | "weekly" | "custom",
      lastCharged: row.lastCharged.toISOString(),
    });
    try {
      await createSubscriptionForUser(authUser.id, {
        name: body.name,
        category: body.category,
        price: body.price,
        billingCycle: body.billingCycle,
        startDate: new Date(body.startDate),
        nextRenewal: new Date(body.nextRenewal),
        status: body.status,
        isShared: body.isShared,
        source: "plaid",
      });
    } catch (e) {
      const limit = planLimitResponse(e);
      if (limit) return limit;
      throw e;
    }
    for (const key of keys) existingKeys.add(key);
    added++;
  }

  console.log("[PATCH /api/plaid/pending-subscriptions]", {
    userId: authUser.id,
    action,
    requested: ids.length,
    added,
    skippedExisting,
  });

  return NextResponse.json({ ok: true, added, skippedExisting });
}
