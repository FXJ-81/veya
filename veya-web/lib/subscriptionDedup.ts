/** Normalize subscription name for duplicate checks (case-insensitive, trimmed). */
export function normalizeSubscriptionNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** All normalized keys from existing user subscriptions (by `name` field). */
export function subscriptionNameKeySet(subs: { name: string }[]): Set<string> {
  const set = new Set<string>();
  for (const s of subs) {
    const k = normalizeSubscriptionNameKey(s.name);
    if (k) set.add(k);
  }
  return set;
}
