import type { Transaction } from "plaid";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";
import { detectSubscriptionsFromPlaidTransactions } from "@/lib/plaidSubscriptionDetect";
import { buildSubscriptionCreateFromPlaid } from "@/lib/plaidImportHelpers";
import {
  classifyPlaidDetectionsForUser,
  keysForPlaidMerchant,
  removeKeysFromDeclinedList,
  type PlaidSyncCandidate,
} from "@/lib/plaidSyncCore";
import { subscriptionNameKeySet } from "@/lib/subscriptionDedup";
import { fetchAllPlaidTransactions } from "@/lib/plaidFetchTransactions";
import { createSubscriptionForUser } from "@/lib/subscriptionCreateInternal";
import { parseSubscriptionCalendarDateInput } from "@/lib/subscriptionBilling";

export type PlaidSyncRunMode = "return_only" | "silent_auto";

export type PlaidSyncRunResult = {
  ok: boolean;
  error?: string;
  bankItemsProcessed: number;
  bankItemsFailed: number;
  transactionsCount: number;
  detectedRaw: number;
  candidates?: PlaidSyncCandidate[];
  autoImported: number;
  skippedExisting: number;
  declinedRowsInModal: number;
  accountErrors: { plaidAccountId: string; message: string }[];
};

/**
 * Shared Plaid transaction pull + subscription detection + dedupe/decline classification.
 * - `return_only`: updates lastSync for successful items, returns candidates for the scan UI (no DB subscription writes).
 * - `silent_auto`: auto-creates new non-declined subscriptions; same dedupe rules as manual.
 */
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
    autoImported: 0,
    skippedExisting: 0,
    declinedRowsInModal: 0,
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

  const [subs, settings] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      select: { id: true, name: true, status: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { plaidDeclinedMerchantKeys: true },
    }),
  ]);

  const declined = settings?.plaidDeclinedMerchantKeys ?? [];
  const { forModal, forAutoImport, skippedExisting, skippedDeclinedOnly } =
    classifyPlaidDetectionsForUser(detected, subs, declined);

  let autoImported = 0;
  const importedKeysToClearFromDeclined: string[] = [];

  if (options.mode === "silent_auto" && forAutoImport.length > 0) {
    const activePausedSubs = subs.filter(
      (s) => s.status === "active" || s.status === "paused",
    );
    const existingKeys = subscriptionNameKeySet(activePausedSubs);
    for (const row of forAutoImport) {
      const keys = keysForPlaidMerchant(row);
      if (keys.some((k) => existingKeys.has(k))) continue;

      const body = buildSubscriptionCreateFromPlaid({
        name: row.name,
        merchantName: row.merchantName,
        category: row.category,
        price: row.price,
        billingCycle: row.billingCycle,
        lastCharged: row.lastCharged,
      });

      try {
        await createSubscriptionForUser(userId, {
          name: body.name,
          category: body.category,
          price: body.price,
          billingCycle: body.billingCycle,
          startDate: parseSubscriptionCalendarDateInput(body.startDate),
          nextRenewal: parseSubscriptionCalendarDateInput(body.nextRenewal),
          status: body.status,
          isShared: body.isShared,
          source: "plaid",
        });
        autoImported++;
        for (const k of keys) {
          existingKeys.add(k);
          importedKeysToClearFromDeclined.push(k);
        }
      } catch (e) {
        console.error("[plaid-sync] auto-import create failed", { userId, name: row.name, e });
      }
    }

    if (importedKeysToClearFromDeclined.length > 0) {
      const fresh = await prisma.userSettings.findUnique({
        where: { userId },
        select: { plaidDeclinedMerchantKeys: true },
      });
      const nextDeclined = removeKeysFromDeclinedList(
        fresh?.plaidDeclinedMerchantKeys ?? [],
        importedKeysToClearFromDeclined,
      );
      await prisma.userSettings.upsert({
        where: { userId },
        create: { userId, plaidDeclinedMerchantKeys: nextDeclined },
        update: { plaidDeclinedMerchantKeys: nextDeclined },
      });
    }
  }

  console.log("[plaid-sync] completed", {
    userId,
    mode: options.mode,
    accounts: accounts.length,
    syncedOk: syncedAccountIds.length,
    failed: bankItemsFailed,
    tx: transactionsCount,
    detected: detectedRaw,
    modalCandidates: forModal.length,
    autoImported,
    skippedExisting,
    declinedRows: skippedDeclinedOnly,
  });

  return {
    ok: true,
    bankItemsProcessed,
    bankItemsFailed,
    transactionsCount,
    detectedRaw,
    autoImported,
    skippedExisting,
    declinedRowsInModal: skippedDeclinedOnly,
    accountErrors,
    candidates: forModal,
  };
}
