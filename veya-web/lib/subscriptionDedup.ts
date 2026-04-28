/** Normalize subscription name for duplicate checks (case-insensitive, trimmed). */
export function normalizeSubscriptionNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Strip punctuation and collapse whitespace — aligned with merchant grouping in
 * `plaidSubscriptionDetect` so bank labels like "NETFLIX.COM" can match saved "Netflix".
 */
export function normalizeMerchantDedupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MERCHANT_MATCH_STOPWORDS = new Set([
  "com",
  "inc",
  "llc",
  "corp",
  "ltd",
  "co",
  "usa",
  "us",
  "the",
  "and",
  "for",
  "payment",
  "pay",
  "pos",
  "ach",
  "bill",
  "card",
  "credit",
  "debit",
  "transfer",
  "srv",
  "service",
]);

/** Alphanumeric tokens (length ≥ 3) used to match bank merchant strings to saved names. */
export function merchantMatchTokens(name: string): string[] {
  const dedup = normalizeMerchantDedupKey(name);
  return dedup
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !MERCHANT_MATCH_STOPWORDS.has(t));
}

/**
 * Broad key set for matching Plaid/bank merchant strings to a user-typed subscription name.
 * Use for canceled-subscription rescan hints; keep `keysForPlaidMerchant` strict elsewhere
 * so declined-merchant keys stay predictable.
 */
export function expandedMerchantMatchKeys(item: { name: string; merchantName?: string }): string[] {
  const keys = new Set<string>();

  const ingestRaw = (raw: string) => {
    const simple = normalizeSubscriptionNameKey(raw);
    if (simple) keys.add(simple);
    const words = normalizeMerchantDedupKey(raw);
    if (words) keys.add(words);
    const compact = words.replace(/\s+/g, "");
    if (compact.length >= 3) keys.add(compact);
    for (const t of merchantMatchTokens(raw)) keys.add(t);
  };

  ingestRaw(item.name);
  const m = item.merchantName?.trim();
  if (m && normalizeSubscriptionNameKey(m) !== normalizeSubscriptionNameKey(item.name)) {
    ingestRaw(m);
  }
  return [...keys];
}

/** All normalized keys from existing user subscriptions (by `name` field). */
export function subscriptionNameKeySet(subs: { name: string }[]): Set<string> {
  const set = new Set<string>();
  const list = Array.isArray(subs) ? subs : [];
  for (const s of list) {
    const k = normalizeSubscriptionNameKey(s.name);
    if (k) set.add(k);
  }
  return set;
}
