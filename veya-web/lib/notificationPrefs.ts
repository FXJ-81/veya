export const NOTIFICATION_PREF_KEYS = [
  "renewalReminders",
  "budgetAlerts",
  "newSubscriptionDetected",
  "weeklySpendingSummary",
  "priceIncreaseAlerts",
] as const;

export type NotificationPrefKey = (typeof NOTIFICATION_PREF_KEYS)[number];

export const DEFAULT_NOTIFICATION_PREFS: Record<NotificationPrefKey, boolean> = {
  renewalReminders: true,
  budgetAlerts: true,
  newSubscriptionDetected: true,
  weeklySpendingSummary: true,
  priceIncreaseAlerts: true,
};

export function mergeNotificationPrefs(stored: unknown): Record<NotificationPrefKey, boolean> {
  const out = { ...DEFAULT_NOTIFICATION_PREFS };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const o = stored as Record<string, unknown>;
    for (const key of NOTIFICATION_PREF_KEYS) {
      if (key in o) out[key] = Boolean(o[key]);
    }
  }
  return out;
}
