import type { PlaidDetectedSubscription } from "@/lib/plaidSubscriptionDetect";
import {
  normalizeSubscriptionNameKey,
  subscriptionNameKeySet,
} from "@/lib/subscriptionDedup";

const MAX_DECLINED_KEYS = 500;

/** Same key rules as Plaid import / subscription name deduplication. */
export function keysForPlaidMerchant(item: { name: string; merchantName?: string }): string[] {
  const keys = new Set<string>();
  const n = normalizeSubscriptionNameKey(item.name);
  if (n) keys.add(n);
  const m = item.merchantName ? normalizeSubscriptionNameKey(item.merchantName) : "";
  if (m && m !== n) keys.add(m);
  return [...keys];
}

export function isPlaidMerchantDuplicateOfExisting(
  item: { name: string; merchantName?: string },
  existingKeys: Set<string>,
  batchSeen: Set<string>,
): boolean {
  const keys = keysForPlaidMerchant(item);
  for (const k of keys) {
    if (existingKeys.has(k) || batchSeen.has(k)) return true;
  }
  return false;
}

export type SubscriptionDedupRow = {
  name: string;
  /** Defaults to active when omitted (tests / older callers). */
  status?: string;
  id: string;
};

export type PlaidSyncCandidate = PlaidDetectedSubscription & {
  defaultSelected: boolean;
  /** Matches a subscription the user canceled; user can restore from the scan modal. */
  previouslyCanceled?: boolean;
  resumeSubscriptionId?: string;
};

function isActiveOrPaused(status: string | undefined): boolean {
  const s = (status ?? "active").toLowerCase();
  return s === "active" || s === "paused";
}

/**
 * Classify raw Plaid detections: skip active/paused matches; surface canceled matches as
 * `previouslyCanceled` for the scan UI. Declined merchants stay in the modal unchecked.
 * Auto-import never re-adds previously canceled rows without user confirmation.
 */
export function classifyPlaidDetectionsForUser(
  detected: PlaidDetectedSubscription[],
  existingSubs: SubscriptionDedupRow[],
  declinedKeys: Iterable<string>,
): {
  /** Shown in scan modal (excludes rows already matching active/paused subscriptions). */
  forModal: PlaidSyncCandidate[];
  /** Safe to auto-import (not declined, not active/paused, not previously canceled). */
  forAutoImport: PlaidDetectedSubscription[];
  skippedExisting: number;
  skippedDeclinedOnly: number;
} {
  const activePaused = existingSubs.filter((s) => isActiveOrPaused(s.status));
  const cancelled = existingSubs.filter((s) => (s.status ?? "").toLowerCase() === "cancelled");

  const activePausedKeys = subscriptionNameKeySet(activePaused);
  const cancelledByKey = new Map<string, string>();
  for (const sub of cancelled) {
    for (const k of keysForPlaidMerchant({ name: sub.name })) {
      if (!cancelledByKey.has(k)) cancelledByKey.set(k, sub.id);
    }
  }

  const declined = new Set(
    [...declinedKeys].map((k) => normalizeSubscriptionNameKey(k)).filter(Boolean),
  );

  const forModal: PlaidSyncCandidate[] = [];
  const forAutoImport: PlaidDetectedSubscription[] = [];
  let skippedExisting = 0;
  let skippedDeclinedOnly = 0;

  const batchSeen = new Set<string>();

  for (const row of detected) {
    const keys = keysForPlaidMerchant(row);
    if (keys.some((k) => activePausedKeys.has(k))) {
      skippedExisting++;
      continue;
    }

    let resumeSubscriptionId: string | undefined;
    for (const k of keys) {
      const sid = cancelledByKey.get(k);
      if (sid) {
        resumeSubscriptionId = sid;
        break;
      }
    }
    const previouslyCanceled = !!resumeSubscriptionId;

    const declinedHit = keys.some((k) => declined.has(k));
    const defaultSelected = !declinedHit;
    if (declinedHit) skippedDeclinedOnly++;

    forModal.push({
      ...row,
      defaultSelected,
      previouslyCanceled,
      resumeSubscriptionId,
    });

    if (!defaultSelected || previouslyCanceled) continue;

    if (keys.some((k) => batchSeen.has(k))) continue;

    forAutoImport.push(row);
    for (const k of keys) batchSeen.add(k);
  }

  return { forModal, forAutoImport, skippedExisting, skippedDeclinedOnly };
}

export function mergeDeclinedMerchantKeys(
  current: string[],
  add: string[],
): string[] {
  const next = new Set<string>();
  for (const k of current) {
    const n = normalizeSubscriptionNameKey(k);
    if (n) next.add(n);
  }
  for (const k of add) {
    const n = normalizeSubscriptionNameKey(k);
    if (n) next.add(n);
  }
  return [...next].slice(0, MAX_DECLINED_KEYS);
}

export function removeKeysFromDeclinedList(current: string[], remove: string[]): string[] {
  const drop = new Set(remove.map((k) => normalizeSubscriptionNameKey(k)).filter(Boolean));
  return current.filter((k) => !drop.has(normalizeSubscriptionNameKey(k)));
}
