/**
 * Plaid bank-scan deduplication and “declined merchant” handling.
 *
 * Shared helpers for Plaid scan deduplication, normalized merchant matching, and the
 * legacy modal classification path.
 */
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

export type PlaidSyncCandidate = PlaidDetectedSubscription & { defaultSelected: boolean };

/**
 * Classify raw Plaid detections: skip anything already saved as a subscription.
 * Declined merchants are still returned for manual review with defaultSelected: false.
 * New merchants get defaultSelected: true.
 */
export function classifyPlaidDetectionsForUser(
  detected: PlaidDetectedSubscription[],
  existingSubs: { name: string }[],
  declinedKeys: Iterable<string>,
): {
  /** Shown in scan modal (excludes rows already in subscription list). */
  forModal: PlaidSyncCandidate[];
  /** Safe to auto-import (not declined, not already a subscription). */
  forAutoImport: PlaidDetectedSubscription[];
  skippedExisting: number;
  skippedDeclinedOnly: number;
} {
  const existingKeys = subscriptionNameKeySet(existingSubs);
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
    if (keys.some((k) => existingKeys.has(k))) {
      skippedExisting++;
      continue;
    }

    const declinedHit = keys.some((k) => declined.has(k));
    const defaultSelected = !declinedHit;
    if (declinedHit) skippedDeclinedOnly++;

    forModal.push({ ...row, defaultSelected });

    if (!defaultSelected) continue;

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
