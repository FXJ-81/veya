/**
 * Canonical subscription / budget categories — use everywhere (modals, budgets, Plaid AI hints).
 */
export const SUBSCRIPTION_CATEGORIES = [
  "Streaming",
  "Music",
  "Productivity",
  "Storage",
  "Gaming",
  "Education",
  "News",
  "Health",
  "Food & Dining",
  "AI",
  "Transport",
  "Travel",
  "Finance",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Other",
] as const;

export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];

/** For budget UI: total row + pickable categories */
export const BUDGET_CATEGORY_OPTIONS = ["__total__", ...SUBSCRIPTION_CATEGORIES] as const;

/** Text for `<option>` labels; keep `value` as the plain category string for DB/API. */
export function categorySelectLabel(category: string): string {
  if (category === "__total__") return "Total subscriptions";
  return category;
}
