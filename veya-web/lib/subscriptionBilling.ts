/** Standard weeks-per-month factor for weekly → monthly normalization */
export const WEEKS_PER_MONTH = 4.33;

export type BillingCycleKey = "monthly" | "yearly" | "weekly" | "custom";

export type ScoreLabelText =
  | "No Data"
  | "Excellent 🟢"
  | "Good 🟢"
  | "Fair 🟡"
  | "Needs Attention 🟡"
  | "High Spend 🔴"
  | "Critical 🔴";

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

/**
 * UTC calendar date as YYYY-MM-DD. Matches API date strings parsed with
 * `new Date("YYYY-MM-DD")` (midnight UTC) so server jobs are consistent across timezones.
 */
export function utcCalendarDateKey(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Whole UTC calendar days from `asOf` until the renewal calendar day (renewal minus asOf).
 * Same calendar day → 0; one day before renewal → 1; exactly one week before → 7.
 */
export function utcCalendarDaysUntilRenewal(renewal: Date, asOf: Date = new Date()): number {
  if (Number.isNaN(renewal.getTime()) || Number.isNaN(asOf.getTime())) return NaN;
  const a = utcCalendarDateKey(asOf);
  const b = utcCalendarDateKey(renewal);
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  const A = Date.UTC(ya, ma - 1, da);
  const B = Date.UTC(yb, mb - 1, db);
  return Math.round((B - A) / 86400000);
}

/** Long renewal label for emails/notifications, tied to the stored UTC calendar day. */
export function formatRenewalDateDisplayUtc(renewal: Date): string {
  const key = utcCalendarDateKey(renewal);
  if (!key || key.length < 10) return "";
  const [y, m, d] = key.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(noonUtc);
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

export type SubscriptionHealthScoreInput = {
  /** Sum of normalized monthly cost for every **active** subscription. */
  monthlyActiveSpend: number;
  activeSubscriptionCount: number;
  pausedSubscriptionCount: number;
  /** Normalized $/mo per active sub (same order as count). */
  activeSubsPricePerMonth: number[];
  /** True only when user has at least one budget and none are over limit (spent ≤ limit). */
  underBudgetOnAllLimits: boolean;
};

/**
 * Subscription health score when there is at least one active subscription.
 * Returns **0** when there are no active subscriptions (caller shows “No Data”).
 *
 * Start at 100, apply tiered deductions/bonuses, clamp to **[5, 100]** when active subs exist.
 */
export function computeSubscriptionHealthScore(input: SubscriptionHealthScoreInput): number {
  const {
    monthlyActiveSpend,
    activeSubscriptionCount: activeN,
    pausedSubscriptionCount: pausedN,
    activeSubsPricePerMonth,
    underBudgetOnAllLimits,
  } = input;

  if (activeN === 0) return 0;

  let score = 100;
  const m = monthlyActiveSpend;

  if (m > 500) score -= 70;
  else if (m >= 301) score -= 55;
  else if (m >= 201) score -= 40;
  else if (m >= 151) score -= 30;
  else if (m >= 101) score -= 20;
  else if (m >= 51) score -= 10;

  if (activeN >= 11) score -= 20;
  else if (activeN >= 7) score -= 10;
  else if (activeN >= 4) score -= 5;

  if (pausedN >= 3) score -= 15;
  else if (pausedN >= 1) score -= 5;

  if (
    activeSubsPricePerMonth.length > 0 &&
    activeSubsPricePerMonth.every((p) => p < 20)
  ) {
    score += 5;
  }
  if (underBudgetOnAllLimits) {
    score += 5;
  }
  if (activeN < 5) {
    score += 5;
  }

  score = Math.round(score);
  return Math.max(5, Math.min(100, score));
}

export function scoreLabel(score: number, hasActiveSubscriptions: boolean): ScoreLabelText {
  if (!hasActiveSubscriptions) return "No Data";
  if (score >= 85) return "Excellent 🟢";
  if (score >= 70) return "Good 🟢";
  if (score >= 55) return "Fair 🟡";
  if (score >= 40) return "Needs Attention 🟡";
  if (score >= 25) return "High Spend 🔴";
  return "Critical 🔴";
}

export function scoreAccentColor(score: number, hasActiveSubscriptions: boolean): string {
  if (!hasActiveSubscriptions) return "#9090aa";
  if (score >= 55) return "#34d399";
  if (score >= 40) return "#fbbf24";
  if (score >= 25) return "#fb923c";
  return "#f87171";
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
