/**
 * Detectors for money, dates, links, and positive/negative billing signals.
 */

import { SUBSCRIPTION_WEIGHTS } from "./weights";

const W = SUBSCRIPTION_WEIGHTS;

export type SignalFlags = {
  hasDollarAmount: boolean;
  hasRenewalLanguage: boolean;
  hasRecurringLanguage: boolean;
  hasSubscriptionNarrative: boolean;
  hasStrongNegativeMarketing: boolean;
  hasShippingNoise: boolean;
  hasSecurityNoise: boolean;
  hasWelcome: boolean;
  hasOneTimeOrderCue: boolean;
  hasTrialEnding: boolean;
};

/** Cheap boolean pass over blob — used for classification after weighted scoring */
export function computeSignalFlags(blob: string): SignalFlags {
  const hasDollarAmount = /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/.test(blob);
  const hasRenewalLanguage =
    /\b(renewal|renews?\s+on|auto[\s-]?renew|next\s+bill|billing\s+date)\b/.test(blob);
  const hasRecurringLanguage =
    /\b(recurring\s+payment|recurring\s+charge|billed\s+monthly|billed\s+annually)\b/.test(blob);
  const hasSubscriptionNarrative =
    /\b(your\s+subscription|your\s+plan|manage\s+(your\s+)?subscription|membership)\b/.test(blob);
  const hasStrongNegativeMarketing =
    /\b(newsletter|weekly\s+digest|blog\s+updates?)\b/.test(blob) ||
    /\b(sale|limited\s+time|\d+%\s+off)\b/.test(blob);
  const hasShippingNoise =
    /\b(shipped|delivered|tracking\s+number|track\s+your\s+package)\b/.test(blob);
  const hasSecurityNoise =
    /\b(password\s+reset|confirm\s+your\s+email|verify\s+your\s+(email|account))\b/.test(blob) ||
    (/\b(new\s+login|security\s+alert)\b/.test(blob) && !hasDollarAmount);
  const hasWelcome = /\bwelcome\s+to\b/.test(blob);
  const hasOneTimeOrderCue =
    /\border\s+confirmation\b/.test(blob) &&
    !/\b(subscription|renew|recurring|membership|plan)\b/.test(blob);
  const hasTrialEnding = /\btrial\s+(ending|ends|expir)/.test(blob);

  return {
    hasDollarAmount,
    hasRenewalLanguage,
    hasRecurringLanguage,
    hasSubscriptionNarrative,
    hasStrongNegativeMarketing,
    hasShippingNoise,
    hasSecurityNoise,
    hasWelcome,
    hasOneTimeOrderCue,
    hasTrialEnding,
  };
}

export function detectSubjectSignals(blob: string, apply: (d: number, r: string) => void): void {
  if (/\binvoice\b/.test(blob)) apply(W.SUBJECT_INVOICE, "subject: invoice");
  if (/\breceipt\b/.test(blob)) apply(W.SUBJECT_RECEIPT, "subject: receipt");
  if (/\brenewal\b|\brenew(s|ed|ing)?\b/.test(blob)) apply(W.SUBJECT_RENEWAL, "subject: renewal");
  if (/membership\s+(renewed|renewal|expires)/.test(blob))
    apply(W.SUBJECT_MEMBERSHIP_RENEWED, "subject: membership renewed");
  if (/upcoming\s+(charge|payment|billing)/.test(blob))
    apply(W.SUBJECT_UPCOMING_CHARGE, "subject: upcoming charge");
  if (/plan\s+(changed|updated|change)/.test(blob))
    apply(W.SUBJECT_PLAN_CHANGED, "subject: plan changed");
  if (/auto[\s-]?renew/.test(blob)) apply(W.SUBJECT_AUTO_RENEWAL, "subject: auto-renewal");
  if (/trial\s+(ending|ends|expir)/.test(blob))
    apply(W.SUBJECT_TRIAL_ENDING, "subject: trial ending");
}

export function detectBodyBillingSignals(blob: string, apply: (d: number, r: string) => void): void {
  if (/\brecurring\s+payment\b/.test(blob)) apply(W.BODY_RECURRING_PAYMENT, "body: recurring payment");
  if (/\bbilled\s+monthly\b|\bmonthly\s+billing\b/.test(blob))
    apply(W.BODY_BILLED_MONTHLY, "body: billed monthly");
  if (/\bbilled\s+annually\b|\bannual(ly)?\s+billing\b/.test(blob))
    apply(W.BODY_BILLED_ANNUALLY, "body: billed annually");
  if (/\brenews?\s+on\b|\brenewal\s+date\b/.test(blob))
    apply(W.BODY_RENEWS_ON, "body: renews on");
  if (/\bnext\s+billing\s+date\b|\bnext\s+charge\b/.test(blob))
    apply(W.BODY_NEXT_BILLING_DATE, "body: next billing date");
  if (/\byour\s+subscription\b/.test(blob)) apply(W.BODY_YOUR_SUBSCRIPTION, "body: your subscription");
  if (/\byour\s+plan\b/.test(blob)) apply(W.BODY_YOUR_PLAN, "body: your plan");
  if (/\bcancel\s+any\s*time\b/.test(blob)) apply(W.BODY_CANCEL_ANYTIME, "body: cancel anytime");
  if (/manage\s+(your\s+)?subscription/.test(blob))
    apply(W.BODY_MANAGE_SUBSCRIPTION, "body: manage subscription");
  if (/update\s+(your\s+)?payment\s+method/.test(blob))
    apply(W.BODY_UPDATE_PAYMENT_METHOD, "body: update payment method");
}

export function detectStructuredPositive(blob: string, apply: (d: number, r: string) => void): void {
  if (/\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/.test(blob))
    apply(W.EVIDENCE_DOLLAR_AMOUNT, "structured: dollar amount");
  if (/\b(renews?|renewal|next\s+bill|billing\s+date|renews?\s+on)\b/.test(blob))
    apply(W.EVIDENCE_RENEWAL_DATE_PHRASE, "structured: renewal / billing date phrase");
  if (/\b(monthly|annual(ly)?|yearly|per\s+month|per\s+year)\s+(plan|billing|subscription)\b/.test(blob))
    apply(W.EVIDENCE_BILLING_PERIOD, "structured: billing period");
  if (/\bcard\s+(ending\s+in|on\s+file)[^\n]{0,20}\*{0,4}\d{4}\b/.test(blob))
    apply(W.EVIDENCE_CARD_LAST4, "structured: card last-4");
  if (/\binvoice\s*#?\s*[A-Z0-9-]{4,}\b/i.test(blob))
    apply(W.EVIDENCE_INVOICE_ID, "structured: invoice id");
  if (/\breceipt\s*#?\s*[A-Z0-9-]{4,}\b/i.test(blob))
    apply(W.EVIDENCE_RECEIPT_ID, "structured: receipt id");
}

export function detectNegativeSignals(blob: string, apply: (d: number, r: string) => void): void {
  if (/\bnewsletter\b/.test(blob)) apply(W.NEG_NEWSLETTER, "negative: newsletter");
  if (/\b(digest|weekly\s+digest|daily\s+digest)\b/.test(blob))
    apply(W.NEG_DIGEST, "negative: digest");
  if (/\bblog\s+updates?\b|\bnew\s+posts?\b/.test(blob))
    apply(W.NEG_BLOG_UPDATES, "negative: blog updates");
  if (/\b(sale|promo|limited\s+time|\d+%\s+off)\b/.test(blob))
    apply(W.NEG_PROMO_MARKETING, "negative: promotional language");
  if (/unsubscribe\s+from\s+(marketing|emails)/.test(blob))
    apply(W.NEG_UNSUBSCRIBE_MARKETING_ONLY, "negative: marketing unsubscribe");
  if (/\bwelcome\s+to\b/.test(blob))
    apply(W.NEG_WELCOME_NO_PAYMENT, "negative: welcome (needs payment evidence)");
  if (/\bpassword\s+reset\b/.test(blob)) apply(W.NEG_PASSWORD_RESET, "negative: password reset");
  if (/\bconfirm\s+your\s+email\b/.test(blob)) apply(W.NEG_VERIFY_EMAIL, "negative: confirm email");
  if (/\bverify\s+your\s+(email|account)\b/.test(blob))
    apply(W.NEG_VERIFY_EMAIL, "negative: verify email/account");
  if (/\bshipped\b|\bhas\s+been\s+shipped\b/.test(blob))
    apply(W.NEG_SHIPPED_DELIVERED, "negative: shipped");
  if (/\bdelivered\b/.test(blob)) apply(W.NEG_SHIPPED_DELIVERED, "negative: delivered");
  if (/\btracking\s+(number|link|info)\b|\btrack\s+your\s+(package|shipment|order)\b/.test(blob))
    apply(W.NEG_TRACKING_PACKAGE, "negative: tracking / package");
  if (
    /\b(new\s+login|sign-?in\s+from|suspicious\s+activity|security\s+alert)\b/.test(blob) &&
    !/\$\s*\d/.test(blob)
  ) {
    apply(W.NEG_SECURITY_ALERT_ONLY, "negative: security alert (no amount)");
  }
  if (/\bstart\s+your\s+free\s+trial\b|\btry\s+free\s+for\b/.test(blob) && !/\$\s*\d/.test(blob)) {
    apply(W.NEG_FREE_TRIAL_INVITE, "negative: free trial invite (no charge shown)");
  }
  if (
    /\border\s+confirmation\b/.test(blob) &&
    !/\b(subscription|renew|recurring|membership|plan)\b/.test(blob)
  ) {
    apply(W.NEG_ONE_TIME_ORDER_STRONG, "negative: order confirmation without subscription cues");
  } else if (/\border\s+#?\s*\d+/.test(blob) && !/\b(subscription|renew|invoice|receipt)\b/.test(blob)) {
    apply(W.NEG_GENERIC_ORDER, "negative: order # without billing context");
  }
}

export function detectLinkSignals(blob: string, apply: (d: number, r: string) => void): void {
  if (/manage.*subscription|subscription.*manage/.test(blob))
    apply(W.LINK_MANAGE_SUBSCRIPTION, "link text: manage subscription");
  if (/\/billing\b|billing\.|billing\?/.test(blob)) apply(W.LINK_BILLING_PORTAL, "link: billing");
  if (/cancel.*plan|plan.*cancel/.test(blob)) apply(W.LINK_CANCEL_PLAN, "link: cancel plan");
  if (/\/invoices?\b|invoices\?/.test(blob)) apply(W.LINK_INVOICES, "link: invoices");
  if (/\/membership\b|membership\?/.test(blob)) apply(W.LINK_MEMBERSHIP, "link: membership");
}
