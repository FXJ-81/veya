/**
 * Canonical subscription / budget category list — use everywhere users pick a category.
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

export const SUBSCRIPTION_CATEGORY_ICONS: Record<string, string> = {
  __total__: "💰",
  Streaming: "📺",
  Music: "🎵",
  Productivity: "💼",
  Storage: "☁️",
  Gaming: "🎮",
  Education: "📚",
  News: "📰",
  Health: "🏃",
  "Food & Dining": "🍔",
  AI: "🤖",
  Transport: "🚗",
  Travel: "✈️",
  Finance: "💳",
  Utilities: "🔌",
  Shopping: "🛍️",
  Entertainment: "🎭",
  Other: "📦",
};

export function categoryIcon(category: string): string {
  return SUBSCRIPTION_CATEGORY_ICONS[category] ?? "📦";
}

export function isKnownSubscriptionCategory(category: string): boolean {
  return (SUBSCRIPTION_CATEGORIES as readonly string[]).includes(category);
}
