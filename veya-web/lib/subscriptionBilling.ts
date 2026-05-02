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

export type PriceChangeSchedule = {
  price: number;
  billingCycle: string;
  upcomingPrice?: number | null;
  upcomingPriceEffectiveAt?: Date | string | null;
};

/**
 * Price effective at `asOf`.
 * - Uses `price` until `upcomingPriceEffectiveAt` (inclusive of that calendar instant).
 * - When an upcoming price exists and the effective time is reached, uses `upcomingPrice`.
 */
export function subscriptionPriceAt(sub: PriceChangeSchedule, asOf: Date = new Date()): number {
  const base = typeof sub.price === "number" ? sub.price : 0;
  const next = sub.upcomingPrice;
  const eff = sub.upcomingPriceEffectiveAt;
  if (next == null || !Number.isFinite(next)) return base;
  if (!eff) return base;
  const effDate = eff instanceof Date ? eff : new Date(eff);
  if (Number.isNaN(effDate.getTime()) || Number.isNaN(asOf.getTime())) return base;
  const effKey = utcCalendarDateKey(effDate);
  const asKey = utcCalendarDateKey(asOf);
  if (!effKey || !asKey) return base;
  return asKey >= effKey ? next : base;
}

export function pricePerMonthAt(sub: PriceChangeSchedule, asOf: Date = new Date()): number {
  return pricePerMonth(subscriptionPriceAt(sub, asOf), sub.billingCycle);
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

/** Last UTC calendar day of `(year, monthIndex)` as YYYY-MM-DD (lex-comparable). */
export function utcLastCalendarDayKeyOfMonth(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex + 1, 0));
  return utcCalendarDateKey(d);
}

/** First UTC calendar day of `(year, monthIndex)` as YYYY-MM-DD (lex-comparable). */
export function utcFirstCalendarDayKeyOfMonth(year: number, monthIndex: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${m}-01`;
}

/**
 * True when UTC calendar month `(year, monthIndex)` overlaps an active plan that ends on
 * `planEndsAt` (inclusive end day). Ongoing when `planEndsAt` is null/invalid.
 */
export function isSubscriptionActiveThroughPlanEnd(
  planEndsAt: Date | null | undefined,
  year: number,
  monthIndex: number
): boolean {
  if (planEndsAt == null || Number.isNaN(planEndsAt.getTime())) return true;
  const endKey = utcCalendarDateKey(planEndsAt);
  if (!endKey) return true;
  return endKey >= utcFirstCalendarDayKeyOfMonth(year, monthIndex);
}

/**
 * True when `asOf` falls on a UTC calendar day strictly after the plan’s inclusive end day.
 */
export function hasPlanEnded(planEndsAt: Date | null | undefined, asOf: Date = new Date()): boolean {
  if (planEndsAt == null || Number.isNaN(planEndsAt.getTime())) return false;
  const endKey = utcCalendarDateKey(planEndsAt);
  const asKey = utcCalendarDateKey(asOf);
  if (!endKey || !asKey) return false;
  return asKey > endKey;
}

/** Last instant of calendar month (UTC), for price-effective-as-of in monthly rollups. */
export function endOfUtcMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

/**
 * Parses `<input type="date" />` values (`YYYY-MM-DD`) and other leading date prefixes as that
 * civil calendar day at **UTC noon** so the stored instant does not shift to the previous local
 * calendar day and analytics month boundaries stay aligned with the user-selected date.
 */
export function parseSubscriptionCalendarDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return new Date(value);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return new Date(value);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return new Date(value);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
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
 * Subscription counts toward spend in a UTC calendar month if its UTC start date is on or
 * before the last UTC day of that month (aligns with `utcCalendarDateKey` / HTML date strings).
 */
export function isSubscriptionActiveInMonth(
  startDate: Date,
  year: number,
  monthIndex: number
): boolean {
  const startKey = utcCalendarDateKey(startDate);
  if (!startKey) return false;
  return startKey <= utcLastCalendarDayKeyOfMonth(year, monthIndex);
}

/** Subscription has started by `asOf` (compared by UTC calendar day). */
export function hasSubscriptionStarted(subStart: Date, asOf: Date = new Date()): boolean {
  const a = utcCalendarDateKey(subStart);
  const b = utcCalendarDateKey(asOf);
  if (!a || !b) return false;
  return a <= b;
}

/**
 * Monthly-equivalent spend from this sub for the given calendar month, or 0 if not active yet.
 */
export function monthlySpendInCalendarMonth(
  sub: { startDate: Date; planEndsAt?: Date | null } & PriceChangeSchedule,
  year: number,
  monthIndex: number
): number {
  if (!isSubscriptionActiveInMonth(sub.startDate, year, monthIndex)) return 0;
  if (!isSubscriptionActiveThroughPlanEnd(sub.planEndsAt ?? null, year, monthIndex)) return 0;
  // Use price effective by the end of the month for projections.
  const asOf = endOfUtcMonth(year, monthIndex);
  return pricePerMonthAt(sub, asOf);
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
