/** Standard weeks-per-month factor for weekly → monthly normalization */
export const WEEKS_PER_MONTH = 4.33;

export type BillingCycleKey = "monthly" | "yearly" | "weekly" | "custom";

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
 * Health score 0–100: higher = better financial shape (lower pressure, reasonable portfolio).
 * Uses real subscription list + normalized monthly burn.
 */
export function computeSubscriptionHealthScore(
  activeSubs: { price: number; billingCycle: string; category: string }[],
  monthlyNormalizedTotal: number
): number {
  if (activeSubs.length === 0) return 88; // no recurring spend → strong score (real data: $0/mo)

  // Spend pressure (max 55): lower monthly outlay = more points
  const spendPoints = Math.max(
    0,
    Math.min(55, 55 - monthlyNormalizedTotal * 0.22)
  );

  // Category diversity (max 25)
  const uniqueCats = new Set(activeSubs.map((s) => s.category)).size;
  const diversityPoints = Math.min(25, uniqueCats * 5);

  // Subscription count — very large stacks are harder to manage (max 20)
  let countPoints = 20;
  if (activeSubs.length > 12) {
    countPoints = Math.max(0, 20 - (activeSubs.length - 12) * 1.5);
  } else if (activeSubs.length < 2) {
    countPoints = 16;
  }

  const raw = spendPoints + diversityPoints + countPoints;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function scoreLabel(score: number): "Needs Review" | "Good" | "Excellent" {
  if (score <= 40) return "Needs Review";
  if (score <= 70) return "Good";
  return "Excellent";
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
