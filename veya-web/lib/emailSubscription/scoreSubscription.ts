/**
 * Main scoring pipeline: combines sender, subject, body, links, structured evidence,
 * and negative signals into an explainable score + classification.
 */

import { DOMAIN_CATALOG, normalizeSenderDomain } from "@/lib/knownSubscriptionDomains";
import type { EmailLikeInput, SubscriptionScoreResult, SubscriptionType } from "./types";
import {
  MIN_CONFIDENCE_SUBSCRIPTION,
  THRESHOLD_RECURRING_CANDIDATE,
  FLOOR_SCORE_FOR_SUBSCRIPTION,
  SUBSCRIPTION_WEIGHTS,
} from "./weights";
import { buildSearchBlob, normalizeEmailBody, normalizeSubject } from "./normalize";
import { parseFromHeader, applySenderLocalPartWeights } from "./extractSender";
import {
  computeSignalFlags,
  detectSubjectSignals,
  detectBodyBillingSignals,
  detectStructuredPositive,
  detectNegativeSignals,
  detectLinkSignals,
} from "./evidence";

const W = SUBSCRIPTION_WEIGHTS;

function classifySubscriptionType(
  score: number,
  flags: ReturnType<typeof computeSignalFlags>
): SubscriptionType {
  if (flags.hasShippingNoise && score < 20) {
    return "one_time_purchase";
  }
  if (flags.hasStrongNegativeMarketing && !flags.hasDollarAmount && score < 28) {
    return "newsletter";
  }
  if ((flags.hasWelcome || flags.hasSecurityNoise) && !flags.hasDollarAmount && score < 25) {
    return "account_email";
  }
  if (
    flags.hasDollarAmount &&
    flags.hasOneTimeOrderCue &&
    !flags.hasRenewalLanguage &&
    !flags.hasRecurringLanguage &&
    !flags.hasSubscriptionNarrative &&
    !flags.hasTrialEnding
  ) {
    return "one_time_purchase";
  }
  if (
    flags.hasDollarAmount &&
    (flags.hasRenewalLanguage ||
      flags.hasRecurringLanguage ||
      flags.hasSubscriptionNarrative ||
      flags.hasTrialEnding ||
      score >= THRESHOLD_RECURRING_CANDIDATE)
  ) {
    return "recurring_paid";
  }
  if (flags.hasDollarAmount && score >= THRESHOLD_RECURRING_CANDIDATE - 8) {
    return "recurring_paid";
  }
  return "unknown";
}

function rawScoreToConfidence(score: number): number {
  return Math.min(1, Math.max(0, (score + 38) / 92));
}

function decideHardRejectBlob(
  score: number,
  flags: ReturnType<typeof computeSignalFlags>,
  subscriptionType: SubscriptionType,
  blob: string
): boolean {
  if (subscriptionType === "newsletter" && !flags.hasDollarAmount && score < 12) return true;
  if (flags.hasShippingNoise && !flags.hasDollarAmount && score < 10) return true;
  if (subscriptionType === "account_email" && !flags.hasDollarAmount && score < 5) return true;
  if (/\bpassword\s+reset\b/.test(blob) && !flags.hasDollarAmount) return true;
  if (/\bconfirm\s+your\s+email\b/.test(blob) && !flags.hasDollarAmount && score < 5) return true;
  return false;
}

/**
 * Score a single email-like payload. Pure function — safe to unit test without Gmail.
 */
export function scoreSubscription(input: EmailLikeInput): SubscriptionScoreResult {
  const subjectNorm = normalizeSubject(input.subject);
  const bodyNorm = normalizeEmailBody(input.bodyText);
  const blob = buildSearchBlob(subjectNorm, bodyNorm, input.snippet);

  let score = 0;
  const reasons: string[] = [];
  const apply = (delta: number, reason: string) => {
    score += delta;
    reasons.push(`${delta >= 0 ? "+" : ""}${delta} ${reason}`);
  };

  const from = parseFromHeader(input.fromHeader);
  if (from) {
    applySenderLocalPartWeights(from.localPart, apply, {
      billing: W.SENDER_BILLING_LOCALPART,
      receipts: W.SENDER_RECEIPTS_LOCALPART,
      payments: W.SENDER_PAYMENTS_LOCALPART,
      membership: W.SENDER_MEMBERSHIP_LOCALPART,
      noreply: W.SENDER_NOREPLY_KNOWN_MERCHANT,
    });

    const root = normalizeSenderDomain(from.domain);
    if (root && DOMAIN_CATALOG[root]) {
      apply(10, `known merchant apex domain (${root})`);
    }
  }

  detectSubjectSignals(blob, apply);
  detectBodyBillingSignals(blob, apply);
  detectStructuredPositive(blob, apply);
  detectLinkSignals(blob, apply);
  detectNegativeSignals(blob, apply);

  const flags = computeSignalFlags(blob);
  const subscriptionType = classifySubscriptionType(score, flags);
  const confidence = rawScoreToConfidence(score);
  const hardReject = decideHardRejectBlob(score, flags, subscriptionType, blob);

  const isSubscription =
    !hardReject &&
    score >= FLOOR_SCORE_FOR_SUBSCRIPTION &&
    confidence >= MIN_CONFIDENCE_SUBSCRIPTION &&
    (subscriptionType === "recurring_paid" ||
      (subscriptionType === "unknown" &&
        flags.hasDollarAmount &&
        (flags.hasRenewalLanguage || flags.hasRecurringLanguage || flags.hasSubscriptionNarrative) &&
        score >= THRESHOLD_RECURRING_CANDIDATE));

  return {
    isSubscription,
    confidence,
    score,
    reasons,
    subscriptionType,
    hardReject,
  };
}
