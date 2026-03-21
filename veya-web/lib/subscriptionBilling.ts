/** Standard weeks-per-month factor for weekly → monthly normalization */
export const WEEKS_PER_MONTH = 4.33;

export type BillingCycleKey = "monthly" | "yearly" | "weekly" | "custom";

export type ScoreLabelText = "No Data" | "Needs Review" | "Good" | "Excellent";

/**
 * Normalized monthly cost for a subscription (what it costs per calendar month).
 */
export function pricePerMonth(price: number, billingCycle: string): number {
  switch (billingCycle) {
    case "yearly":
      return price / 12;
    case "weekly":
      return price * WEEKS_PER_MONTH;
    case "custom":
    case "monthly":
    default:
      return price;
  }
}

/** Start of local calendar day */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Last instant of calendar month (local) */
export function endOfLocalMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
}

/**
 * Subscription counts toward spend in a calendar month if it has started on or before
 * the last day of that month (and we only consider currently loaded subs — see API).
 */
export function isSubscriptionActiveInMonth(
  startDate: Date,
  year: number,
  monthIndex: number
): boolean {
  const start = startOfLocalDay(startDate);
  const monthEnd = endOfLocalMonth(year, monthIndex);
  return start <= monthEnd;
}

/** For “current” monthly total: subscription must have started by today (local). */
export function hasSubscriptionStarted(subStart: Date, asOf: Date = new Date()): boolean {
  return startOfLocalDay(subStart) <= startOfLocalDay(asOf);
}

/**
 * Monthly-equivalent spend from this sub for the given calendar month, or 0 if not active yet.
 */
export function monthlySpendInCalendarMonth(
  sub: { startDate: Date; price: number; billingCycle: string },
  year: number,
  monthIndex: number
): number {
  if (!isSubscriptionActiveInMonth(sub.startDate, year, monthIndex)) return 0;
  return pricePerMonth(sub.price, sub.billingCycle);
}

/**
 * Subscription health score (1–100) when there is at least one active subscription.
 * With no active subscriptions, the API returns 0 instead (see caller).
 *
 * Start at 100, apply deductions and bonuses, clamp to [1, 100].
 */
export function computeSubscriptionHealthScore(
  activeSubs: { price: number; billingCycle: string; category: string }[],
  monthlyNormalizedTotal: number
): number {
  if (activeSubs.length === 0) return 0;

  let score = 100;
  const n = activeSubs.length;

  if (n > 5) {
    score -= 5 * (n - 5);
  }

  const S = monthlyNormalizedTotal;
  if (S > 50) {
    score -= Math.floor((S - 50) / 5);
  }
  if (S > 100) {
    score -= Math.floor((S - 100) / 10) * 2;
  }

  const uniqueCats = new Set(activeSubs.map((s) => s.category)).size;
  if (uniqueCats === 1) {
    score -= 10;
  }

  for (const s of activeSubs) {
    const pm = pricePerMonth(s.price, s.billingCycle);
    if (pm > 30) {
      score -= 5;
    }
  }

  if (uniqueCats >= 3) {
    score += 10;
  }

  const allUnder20 = activeSubs.every(
    (s) => pricePerMonth(s.price, s.billingCycle) < 20
  );
  if (allUnder20) {
    score += 10;
  }

  if (n < 3) {
    score += 5;
  }

  score = Math.round(score);
  return Math.max(1, Math.min(100, score));
}

export function scoreLabel(score: number, hasActiveSubscriptions: boolean): ScoreLabelText {
  if (!hasActiveSubscriptions) return "No Data";
  if (score <= 40) return "Needs Review";
  if (score <= 70) return "Good";
  return "Excellent";
}

export function scoreAccentColor(score: number, hasActiveSubscriptions: boolean): string {
  if (!hasActiveSubscriptions) return "#9090aa";
  if (score <= 40) return "#f87171";
  if (score <= 70) return "#fbbf24";
  return "#34d399";
}

/** Stable palette index for category → color alignment in charts */
export const CATEGORY_CHART_COLORS = [
  "#5b6ef5",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#22d3ee",
  "#fb923c",
  "#e879f9",
  "#4ade80",
  "#94a3b8",
];

export function categoryColorAt(index: number): string {
  return CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length];
}
