import type { Subscription } from "@/types";
import { formatDate, getDaysUntil } from "@/lib/utils";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * If stored next renewal is before today (local midnight), bump from today by one billing period.
 * Used for active subscriptions only.
 */
export function addBillingPeriodFromToday(cycle: string): Date {
  const d = startOfToday();
  if (cycle === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (cycle === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    // monthly, custom, unknown → treat as monthly
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export function isRenewalDateInPast(iso: string): boolean {
  const next = new Date(iso);
  next.setHours(0, 0, 0, 0);
  const t = startOfToday();
  return next < t;
}

export type EffectiveRenewal = {
  /** ISO string used for sorting / day math */
  nextRenewalIso: string;
  /** Shown on the card under "Next:" */
  displayLine: string;
  daysUntil: number;
  isPaused: boolean;
};

/**
 * Display + countdown rules:
 * - Paused → "Paused", no real countdown
 * - Active + past renewal → today + one period (month/year/week)
 * - Otherwise → stored date
 */
export function getEffectiveRenewal(sub: Subscription): EffectiveRenewal {
  if (sub.status === "paused") {
    return {
      nextRenewalIso: sub.nextRenewal,
      displayLine: "Paused",
      daysUntil: Number.POSITIVE_INFINITY,
      isPaused: true,
    };
  }

  if (sub.status !== "active") {
    const next = new Date(sub.nextRenewal);
    return {
      nextRenewalIso: sub.nextRenewal,
      displayLine: formatDate(sub.nextRenewal),
      daysUntil: getDaysUntil(next),
      isPaused: false,
    };
  }

  if (isRenewalDateInPast(sub.nextRenewal)) {
    const bumped = addBillingPeriodFromToday(sub.billingCycle);
    const iso = bumped.toISOString();
    return {
      nextRenewalIso: iso,
      displayLine: formatDate(iso),
      daysUntil: getDaysUntil(bumped),
      isPaused: false,
    };
  }

  const next = new Date(sub.nextRenewal);
  return {
    nextRenewalIso: sub.nextRenewal,
    displayLine: formatDate(sub.nextRenewal),
    daysUntil: getDaysUntil(next),
    isPaused: false,
  };
}

/** Sort key: paused last, then by effective next renewal */
export function nextRenewalSortKey(sub: Subscription): number {
  if (sub.status === "paused") return Number.MAX_SAFE_INTEGER;
  return new Date(getEffectiveRenewal(sub).nextRenewalIso).getTime();
}
