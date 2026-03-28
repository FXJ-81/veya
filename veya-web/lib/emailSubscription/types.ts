/**
 * High-level classification for finance / subscription UX.
 * Distinct from `isSubscription`, which gates whether we offer this as a trackable recurring bill.
 */
export type SubscriptionType =
  | "recurring_paid"
  | "one_time_purchase"
  | "newsletter"
  | "account_email"
  | "unknown";

/**
 * Result of the scoring pipeline. Tuned for explainability and easy A/B of weights.
 */
export type SubscriptionScoreResult = {
  /** True when we recommend surfacing this as a paid recurring subscription candidate */
  isSubscription: boolean;
  /** 0–1 — how sure we are in the chosen `subscriptionType` / `isSubscription` decision */
  confidence: number;
  /** Raw weighted sum before normalization (for debugging and dashboards) */
  score: number;
  /** Human-readable trail of which signals fired (positive and negative) */
  reasons: string[];
  subscriptionType: SubscriptionType;
  /**
   * Skip further processing entirely (shipping, pure security, obvious newsletter with no payment story).
   * Stronger than `!isSubscription` — avoids burning user attention on obvious non-billing mail.
   */
  hardReject: boolean;
};

/** Input shape works for Gmail, webhooks, or pasted RFC822 snippets */
export type EmailLikeInput = {
  fromHeader: string;
  subject: string;
  /** Plain-ish text; caller should strip HTML and trim footers when possible */
  bodyText: string;
  /** Gmail snippet — short free-text preview, boosts subject/body when present */
  snippet?: string;
};
