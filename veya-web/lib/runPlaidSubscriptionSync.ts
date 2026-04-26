/**
 * Orchestrates one Plaid sync run for a user: pull transactions (per linked bank), detect
 * subscription-like spend, classify against active subscriptions plus saved candidate state,
 * and persist reviewable pending candidates without auto-adding them.
 */
import type { PlaidDetectedSubscription } from "@/lib/plaidSubscriptionDetect";
import type { Transaction } from "plaid";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";
import { detectSubscriptionsFromPlaidTransactions } from "@/lib/plaidSubscriptionDetect";
import { primaryPlaidCandidateKey } from "@/lib/plaidCandidateState";
import { keysForPlaidMerchant, type PlaidSyncCandidate } from "@/lib/plaidSyncCore";
import { subscriptionNameKeySet } from "@/lib/subscriptionDedup";
import { fetchAllPlaidTransactions } from "@/lib/plaidFetchTransactions";

export type PlaidSyncRunMode = "store_pending";

export type PlaidSyncRunResult = {
  ok: boolean;
  error?: string;
  bankItemsProcessed: number;
  bankItemsFailed: number;
  transactionsCount: number;
  detectedRaw: number;
  candidates?: PlaidSyncCandidate[];
  skippedExisting: number;
  pendingCreated: number;
  pendingUpdated: number;
  declinedSuppressed: number;
  addedSuppressed: number;
  duplicatesCollapsed: number;
  accountErrors: { plaidAccountId: string; message: string }[];
};

export async function runPlaidSubscriptionSyncForUser(
  userId: string,
  options: {
    plaidAccountId?: string;
    mode: PlaidSyncRunMode;
  },
): Promise<PlaidSyncRunResult> {
  const empty = (): PlaidSyncRunResult => ({
    ok: false,
    error: undefined,
    bankItemsProcessed: 0,
    bankItemsFailed: 0,
    transactionsCount: 0,
    detectedRaw: 0,
    candidates: [],
    skippedExisting: 0,
    pendingCreated: 0,
    pendingUpdated: 0,
    declinedSuppressed: 0,
    addedSuppressed: 0,
    duplicatesCollapsed: 0,
    accountErrors: [],
  });

  const accounts = await prisma.plaidAccount.findMany({
    where: {
      userId,
      ...(options.plaidAccountId ? { id: options.plaidAccountId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    return { ...empty(), ok: false, error: "Bank not connected" };
  }

  let plaid;
  try {
    plaid = getPlaidClient();
  } catch (e) {
    console.error("[plaid-sync] Plaid client init failed", e);
    return { ...empty(), ok: false, error: "Plaid unavailable" };
  }

  const allTx: Transaction[] = [];
  const accountErrors: { plaidAccountId: string; message: string }[] = [];
  const syncedAccountIds: string[] = [];
  let bankItemsProcessed = 0;
  let bankItemsFailed = 0;

  for (const acc of accounts) {
    try {
      const batch = await fetchAllPlaidTransactions(plaid, acc.accessToken);
      allTx.push(...batch);
      syncedAccountIds.push(acc.id);
      bankItemsProcessed++;
    } catch (e) {
      bankItemsFailed++;
      const msg = e instanceof Error ? e.message : String(e);
      accountErrors.push({ plaidAccountId: acc.id, message: msg });
      console.error("[plaid-sync] transactions failed", { userId, plaidAccountId: acc.id, msg });
    }
  }

  if (syncedAccountIds.length > 0) {
    const now = new Date();
    await prisma.plaidAccount.updateMany({
      where: { id: { in: syncedAccountIds } },
      data: { lastSync: now },
    });
  }

  const detected = await detectSubscriptionsFromPlaidTransactions(allTx);
  const transactionsCount = allTx.length;
  const detectedRaw = detected.length;

  const [subs, settings, existingCandidates] = await Promise.all([
    prisma.subscription.findMany({ where: { userId }, select: { name: true } }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { plaidDeclinedMerchantKeys: true },
    }),
    prisma.plaidSubscriptionCandidate.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const activeKeys = subscriptionNameKeySet(subs);
  const declinedKeySet = new Set(settings?.plaidDeclinedMerchantKeys ?? []);
  const candidateKeyMap = new Map<string, (typeof existingCandidates)[number]>();
  for (const candidate of existingCandidates) {
    candidateKeyMap.set(candidate.normalizedMerchantKey, candidate);
    for (const key of candidate.matchKeys) {
      candidateKeyMap.set(key, candidate);
    }
  }

  const candidatesForReview: PlaidSyncCandidate[] = [];
  let skippedExisting = 0;
  let pendingCreated = 0;
  let pendingUpdated = 0;
  let declinedSuppressed = 0;
  let addedSuppressed = 0;
  let duplicatesCollapsed = 0;

  const creates: Array<{
    row: PlaidDetectedSubscription;
    keys: string[];
    primaryKey: string;
    status: "pending" | "declined";
  }> = [];
  const updates = new Map<string, {
    row: PlaidDetectedSubscription;
    keys: string[];
    status: "pending" | "declined" | "added";
  }>();
  const batchSeen = new Set<string>();

  for (const row of detected) {
    const keys = keysForPlaidMerchant(row);
    if (keys.length === 0) continue;

    if (keys.some((key) => activeKeys.has(key))) {
      skippedExisting++;
      continue;
    }

    if (keys.some((key) => batchSeen.has(key))) {
      duplicatesCollapsed++;
      continue;
    }
    for (const key of keys) batchSeen.add(key);

    const existingCandidate = keys
      .map((key) => candidateKeyMap.get(key))
      .find((candidate): candidate is (typeof existingCandidates)[number] => !!candidate);

    if (existingCandidate) {
      const status =
        existingCandidate.status === "declined"
          ? "declined"
          : existingCandidate.status === "added"
            ? "added"
            : "pending";
      updates.set(existingCandidate.id, { row, keys, status });
      if (status === "pending") {
        pendingUpdated++;
        candidatesForReview.push({ ...row, defaultSelected: true });
      } else if (status === "declined") {
        declinedSuppressed++;
      } else {
        addedSuppressed++;
      }
      continue;
    }

    const suppressedByLegacyDecline = keys.some((key) => declinedKeySet.has(key));
    const status: "pending" | "declined" = suppressedByLegacyDecline ? "declined" : "pending";
    creates.push({
      row,
      keys,
      primaryKey: primaryPlaidCandidateKey(row),
      status,
    });
    if (status === "pending") {
      pendingCreated++;
      candidatesForReview.push({ ...row, defaultSelected: true });
    } else {
      declinedSuppressed++;
    }
  }

  if (updates.size > 0 || creates.length > 0) {
    const now = new Date();
    await prisma.$transaction([
      ...[...updates.entries()].map(([id, entry]) =>
        prisma.plaidSubscriptionCandidate.update({
          where: { id },
          data: {
            matchKeys: entry.keys,
            name: entry.row.name,
            merchantName: entry.row.merchantName ?? entry.row.name,
            category: entry.row.category,
            price: entry.row.price,
            billingCycle: entry.row.billingCycle,
            lastCharged: new Date(entry.row.lastCharged),
            confidence: entry.row.confidence,
            status: entry.status,
            lastDetectedAt: now,
          },
        })
      ),
      ...creates.map((entry) =>
        prisma.plaidSubscriptionCandidate.upsert({
          where: {
            userId_normalizedMerchantKey: {
              userId,
              normalizedMerchantKey: entry.primaryKey,
            },
          },
          create: {
            userId,
            normalizedMerchantKey: entry.primaryKey,
            matchKeys: entry.keys,
            name: entry.row.name,
            merchantName: entry.row.merchantName ?? entry.row.name,
            category: entry.row.category,
            price: entry.row.price,
            billingCycle: entry.row.billingCycle,
            lastCharged: new Date(entry.row.lastCharged),
            confidence: entry.row.confidence,
            status: entry.status,
            firstDetectedAt: now,
            lastDetectedAt: now,
          },
          update: {
            matchKeys: entry.keys,
            name: entry.row.name,
            merchantName: entry.row.merchantName ?? entry.row.name,
            category: entry.row.category,
            price: entry.row.price,
            billingCycle: entry.row.billingCycle,
            lastCharged: new Date(entry.row.lastCharged),
            confidence: entry.row.confidence,
            status: entry.status,
            lastDetectedAt: now,
          },
        })
      ),
    ]);
  }

  console.log("[plaid-sync] completed", {
    userId,
    mode: options.mode,
    accounts: accounts.length,
    syncedOk: syncedAccountIds.length,
    failed: bankItemsFailed,
    tx: transactionsCount,
    detected: detectedRaw,
    reviewCandidates: candidatesForReview.length,
    skippedExisting,
    pendingCreated,
    pendingUpdated,
    declinedSuppressed,
    addedSuppressed,
    duplicatesCollapsed,
  });

  return {
    ok: true,
    bankItemsProcessed,
    bankItemsFailed,
    transactionsCount,
    detectedRaw,
    skippedExisting,
    pendingCreated,
    pendingUpdated,
    declinedSuppressed,
    addedSuppressed,
    duplicatesCollapsed,
    accountErrors,
    candidates: candidatesForReview,
  };
}
