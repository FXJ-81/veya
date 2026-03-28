/**
 * Central tuning knobs. Increase magnitude to make that signal matter more.
 * Keep comments short but point to the detector that consumes each weight.
 */

export const SUBSCRIPTION_WEIGHTS = {
  // --- Sender local-part (billing@, receipts@, …) — high precision for real merchants ---
  SENDER_BILLING_LOCALPART: 14,
  SENDER_RECEIPTS_LOCALPART: 14,
  SENDER_PAYMENTS_LOCALPART: 12,
  SENDER_MEMBERSHIP_LOCALPART: 12,
  SENDER_NOREPLY_KNOWN_MERCHANT: 6, // weaker alone; noreply is common everywhere

  // --- Subject: transactional billing language ---
  SUBJECT_INVOICE: 10,
  SUBJECT_RECEIPT: 10,
  SUBJECT_RENEWAL: 14,
  SUBJECT_MEMBERSHIP_RENEWED: 16,
  SUBJECT_UPCOMING_CHARGE: 15,
  SUBJECT_PLAN_CHANGED: 12,
  SUBJECT_AUTO_RENEWAL: 14,
  SUBJECT_TRIAL_ENDING: 11,

  // --- Body: recurring / subscription narrative (Rocket Money–style evidence) ---
  BODY_RECURRING_PAYMENT: 16,
  BODY_BILLED_MONTHLY: 14,
  BODY_BILLED_ANNUALLY: 14,
  BODY_RENEWS_ON: 15,
  BODY_NEXT_BILLING_DATE: 14,
  BODY_YOUR_SUBSCRIPTION: 10,
  BODY_YOUR_PLAN: 8,
  BODY_CANCEL_ANYTIME: 8,
  BODY_MANAGE_SUBSCRIPTION: 12,
  BODY_UPDATE_PAYMENT_METHOD: 10,

  // --- Structured billing artifacts (hard to fake in bulk marketing) ---
  EVIDENCE_DOLLAR_AMOUNT: 12,
  EVIDENCE_RENEWAL_DATE_PHRASE: 10,
  EVIDENCE_BILLING_PERIOD: 10,
  EVIDENCE_CARD_LAST4: 14,
  EVIDENCE_INVOICE_ID: 8,
  EVIDENCE_RECEIPT_ID: 8,

  // --- Links (often in HTML href text) ---
  LINK_MANAGE_SUBSCRIPTION: 10,
  LINK_BILLING_PORTAL: 10,
  LINK_CANCEL_PLAN: 10,
  LINK_INVOICES: 8,
  LINK_MEMBERSHIP: 6,

  // --- Negative: marketing / lifecycle noise ---
  NEG_NEWSLETTER: -22,
  NEG_DIGEST: -18,
  NEG_BLOG_UPDATES: -16,
  NEG_PROMO_MARKETING: -20,
  NEG_UNSUBSCRIBE_MARKETING_ONLY: -12, // footer alone; paired with strong billing can survive
  NEG_WELCOME_NO_PAYMENT: -18,
  NEG_PASSWORD_RESET: -30,
  NEG_VERIFY_EMAIL: -28,
  NEG_SECURITY_ALERT_ONLY: -24,

  // --- Negative: commerce but not recurring subscription ---
  NEG_SHIPPED_DELIVERED: -35,
  NEG_TRACKING_PACKAGE: -32,
  NEG_ONE_TIME_ORDER_STRONG: -14, // "order confirmation" without renewal language

  // --- Penalty when "order" appears without subscription/recurring context ---
  NEG_GENERIC_ORDER: -8,

  /** Trial signup CTA without a charge line — not the same as "trial ending" renewal notices */
  NEG_FREE_TRIAL_INVITE: -14,
} as const;

/** Score above this tends to be recurring billing; tune with your false positive budget */
export const THRESHOLD_RECURRING_CANDIDATE = 38;

/** Minimum confidence to treat as subscription candidate in Gmail import */
export const MIN_CONFIDENCE_SUBSCRIPTION = 0.48;

/** Below this raw score we never mark `isSubscription` even if type guesses recurring */
export const FLOOR_SCORE_FOR_SUBSCRIPTION = 15;
