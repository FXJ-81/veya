import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import {
  computeSubscriptionHealthScore,
  hasSubscriptionStarted,
  monthlySpendInCalendarMonth,
  pricePerMonth,
  pricePerMonthAt,
} from "@/lib/subscriptionBilling";
import { getEffectiveRenewal } from "@/lib/subscriptionRenewal";
import type { Subscription } from "@/types";
import { requirePremiumFeature } from "@/lib/planLimits";
import { readUpcomingPriceRowsForUser, upcomingPriceMap } from "@/lib/subscriptionUpcomingSql";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Typical U.S. monthly subscription spend (reference benchmark for comparisons). */
const US_AVG_MONTHLY_SUBS = 219;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type AnalyticsInsightCard = {
  /** Semantic key rendered as a Lucide icon on the client */
  icon: string;
  title: string;
  description: string;
};

function prismaSubToType(s: {
  id: string;
  userId: string;
  name: string;
  category: string;
  price: number;
  upcomingPrice?: number | null;
  upcomingPriceEffectiveAt?: Date | null;
  billingCycle: string;
  startDate: Date;
  nextRenewal: Date;
  status: string;
  logoUrl: string | null;
  notes: string | null;
  isShared: boolean;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Subscription {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    category: s.category,
    price: s.price,
    upcomingPrice: s.upcomingPrice ?? null,
    upcomingPriceEffectiveAt: s.upcomingPriceEffectiveAt?.toISOString() ?? null,
    billingCycle: s.billingCycle as Subscription["billingCycle"],
    startDate: s.startDate.toISOString(),
    nextRenewal: s.nextRenewal.toISOString(),
    status: s.status as Subscription["status"],
    logoUrl: s.logoUrl,
    notes: s.notes,
    isShared: s.isShared,
    color: s.color,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function buildInsightCards(params: {
  currentMonthlyNormalized: number;
  yearlyProjection: number;
  categoryBreakdown: { category: string; total: number }[];
  activeStarted: Subscription[];
  budgets: { id: string; category: string; limit: number }[];
  spendByCategory: Map<string, number>;
  totalMonthlySpend: number;
}): AnalyticsInsightCard[] {
  const {
    currentMonthlyNormalized,
    yearlyProjection,
    categoryBreakdown,
    activeStarted,
    budgets,
    spendByCategory,
    totalMonthlySpend,
  } = params;

  const cards: AnalyticsInsightCard[] = [];

  // 1 — Monthly total vs U.S. average (~$219/mo)
  if (currentMonthlyNormalized <= 0) {
    cards.push({
      icon: "globe",
      title: "Monthly spend vs U.S. average",
      description: `You’re at $0/mo tracked; typical U.S. subscription spend is ~$${US_AVG_MONTHLY_SUBS}/mo.`,
    });
  } else {
    const diff = currentMonthlyNormalized - US_AVG_MONTHLY_SUBS;
    const absPct =
      US_AVG_MONTHLY_SUBS > 0 ? Math.round((Math.abs(diff) / US_AVG_MONTHLY_SUBS) * 100) : 0;
    if (diff > 1) {
      cards.push({
        icon: "trend-up",
        title: "Monthly spend vs U.S. average",
        description: `~$${currentMonthlyNormalized.toFixed(2)}/mo — about ${absPct}% above the ~$${US_AVG_MONTHLY_SUBS}/mo benchmark.`,
      });
    } else if (diff < -1) {
      cards.push({
        icon: "check",
        title: "Monthly spend vs U.S. average",
        description: `~$${currentMonthlyNormalized.toFixed(2)}/mo — ${absPct}% under the ~$${US_AVG_MONTHLY_SUBS}/mo benchmark.`,
      });
    } else {
      cards.push({
        icon: "scale",
        title: "Monthly spend vs U.S. average",
        description: `~$${currentMonthlyNormalized.toFixed(2)}/mo — aligned with the ~$${US_AVG_MONTHLY_SUBS}/mo typical.`,
      });
    }
  }

  // 2 — Top spending category + amount
  if (categoryBreakdown.length === 0) {
    cards.push({
      icon: "tag",
      title: "Top spending category",
      description: "Add subscriptions to see your #1 category and its monthly total.",
    });
  } else {
    const top = categoryBreakdown[0];
    const catSum = categoryBreakdown.reduce((a, c) => a + c.total, 0);
    const share = catSum > 0 ? Math.round((top.total / catSum) * 100) : 0;
    cards.push({
      icon: "tag",
      title: `${top.category} leads spending`,
      description: `~$${top.total.toFixed(2)}/mo — ${share}% of categorized spend.`,
    });
  }

  // 3 — Most expensive single subscription
  const byMonthly = [...activeStarted].sort(
    (a, b) => pricePerMonth(b.price, b.billingCycle) - pricePerMonth(a.price, a.billingCycle),
  );
  if (byMonthly.length === 0) {
    cards.push({
      icon: "wallet",
      title: "Most expensive subscription",
      description: "Add active subscriptions to see your highest monthly line item.",
    });
  } else {
    const m = byMonthly[0];
    const pm = pricePerMonth(m.price, m.billingCycle);
    cards.push({
      icon: "wallet",
      title: `${m.name} is priciest`,
      description: `~$${pm.toFixed(2)}/mo (${m.billingCycle}, normalized).`,
    });
  }

  // 4 — Over budget (worst) OR renewals in 7d OR yearly projection
  let worst: { label: string; spent: number; limit: number } | null = null;
  let worstRatio = 0;
  for (const b of budgets) {
    const spent =
      b.category === "__total__"
        ? totalMonthlySpend
        : (spendByCategory.get(b.category) ?? 0);
    if (b.limit <= 0) continue;
    if (spent > b.limit) {
      const ratio = spent / b.limit;
      if (ratio > worstRatio) {
        worstRatio = ratio;
        worst = {
          label: b.category === "__total__" ? "All subscriptions" : b.category,
          spent,
          limit: b.limit,
        };
      }
    }
  }

  const soon: { name: string; days: number }[] = [];
  for (const s of activeStarted) {
    const er = getEffectiveRenewal(s);
    if (!Number.isFinite(er.daysUntil)) continue;
    if (er.daysUntil >= 0 && er.daysUntil <= 7) {
      soon.push({ name: s.name, days: Math.max(0, Math.floor(er.daysUntil)) });
    }
  }
  soon.sort((a, b) => a.days - b.days);

  let fourth: AnalyticsInsightCard;
  if (worst) {
    fourth = {
      icon: "alert",
      title: `Over budget: ${worst.label}`,
      description: `$${worst.spent.toFixed(2)} of $${worst.limit.toFixed(2)}/mo — you’re above limit.`,
    };
  } else if (soon.length > 0) {
    const list = soon
      .slice(0, 3)
      .map((x) => `${x.name} (${x.days === 0 ? "today" : `${x.days}d`})`)
      .join(", ");
    const more = soon.length > 3 ? ` +${soon.length - 3} more` : "";
    fourth = {
      icon: "clock",
      title: `${soon.length} renewal${soon.length === 1 ? "" : "s"} this week`,
      description: `${list}${more}.`,
    };
  } else if (yearlyProjection > 0) {
    fourth = {
      icon: "calendar",
      title: "Yearly projection",
      description: `~$${yearlyProjection.toFixed(0)}/yr at your current ~$${currentMonthlyNormalized.toFixed(2)}/mo run rate.`,
    };
  } else {
    fourth = {
      icon: "calendar",
      title: "Yearly projection",
      description: "Add active subscriptions to estimate yearly subscription cost.",
    };
  }

  cards.push(fourth);
  return cards;
}

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const premiumGate = await requirePremiumFeature(authUser.id, "Analytics");
  if (premiumGate) return premiumGate;

  const [subsActive, pausedCount, budgets] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: authUser.id, status: "active" },
    }),
    prisma.subscription.count({
      where: { userId: authUser.id, status: "paused" },
    }),
    prisma.budget.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const upcoming = upcomingPriceMap(
    await readUpcomingPriceRowsForUser(prisma, authUser.id, subsActive.map((s) => s.id)),
  );

  const now = new Date();
  const year = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  const monthlySpend: {
    month: number;
    year: number;
    total: number;
    label: string;
    period: "past" | "current" | "future";
    contributors: { name: string; amount: number }[];
  }[] = [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    let period: "past" | "current" | "future";
    if (monthIndex < currentMonthIndex) period = "past";
    else if (monthIndex === currentMonthIndex) period = "current";
    else period = "future";

    const contributors: { name: string; amount: number }[] = [];
    let total = 0;

    for (const s of subsActive) {
      const u = upcoming.get(s.id);
      const raw = monthlySpendInCalendarMonth(
        {
          startDate: s.startDate,
          price: s.price,
          billingCycle: s.billingCycle,
          upcomingPrice: u?.upcomingPrice ?? null,
          upcomingPriceEffectiveAt: u?.upcomingPriceEffectiveAt ?? null,
        },
        year,
        monthIndex,
      );
      if (raw <= 0) continue;

      total += raw;
      contributors.push({ name: s.name, amount: round2(raw) });
    }

    contributors.sort((a, b) => b.amount - a.amount);

    monthlySpend.push({
      month: monthIndex + 1,
      year,
      total: round2(total),
      label: MONTH_SHORT[monthIndex],
      period,
      contributors,
    });
  }

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const s of subsActive) {
    const u = upcoming.get(s.id);
    const perMonth = pricePerMonthAt(
      {
        price: s.price,
        billingCycle: s.billingCycle,
        upcomingPrice: u?.upcomingPrice ?? null,
        upcomingPriceEffectiveAt: u?.upcomingPriceEffectiveAt ?? null,
      },
      now,
    );
    const cur = categoryMap.get(s.category) ?? { total: 0, count: 0 };
    cur.total += perMonth;
    cur.count += 1;
    categoryMap.set(s.category, cur);
  }

  const categoryTotals = Array.from(categoryMap.entries()).map(([category, v]) => ({
    category,
    total: Math.round(v.total * 100) / 100,
    count: v.count,
  }));

  const categorySum = categoryTotals.reduce((acc, c) => acc + c.total, 0);
  const categoryBreakdown = categoryTotals
    .sort((a, b) => b.total - a.total)
    .map((c) => ({
      ...c,
      percentage: categorySum > 0 ? Math.round((c.total / categorySum) * 1000) / 10 : 0,
    }));

  /** All **active** subs: normalized $/mo (matches category card & score; avoids $0 when startDate is future). */
  const activeMonthlyTotal = round2(
    subsActive.reduce(
      (sum, s) => {
        const u = upcoming.get(s.id);
        return (
          sum +
          pricePerMonthAt(
            {
              price: s.price,
              billingCycle: s.billingCycle,
              upcomingPrice: u?.upcomingPrice ?? null,
              upcomingPriceEffectiveAt: u?.upcomingPriceEffectiveAt ?? null,
            },
            now,
          )
        );
      },
      0,
    ),
  );

  const yearlyProjection = round2(activeMonthlyTotal * 12);

  const hasActiveSubscriptions = subsActive.length > 0;

  const activeSubsPricePerMonth = subsActive.map((s) =>
    pricePerMonthAt(
      {
        price: s.price,
        billingCycle: s.billingCycle,
        upcomingPrice: upcoming.get(s.id)?.upcomingPrice ?? null,
        upcomingPriceEffectiveAt: upcoming.get(s.id)?.upcomingPriceEffectiveAt ?? null,
      },
      now,
    ),
  );

  const spendByCategory = new Map<string, number>();
  let totalMonthlySpend = 0;
  for (const s of subsActive) {
    if (!hasSubscriptionStarted(s.startDate, now)) continue;
    const u = upcoming.get(s.id);
    const monthly = pricePerMonthAt(
      {
        price: s.price,
        billingCycle: s.billingCycle,
        upcomingPrice: u?.upcomingPrice ?? null,
        upcomingPriceEffectiveAt: u?.upcomingPriceEffectiveAt ?? null,
      },
      now,
    );
    spendByCategory.set(s.category, (spendByCategory.get(s.category) ?? 0) + monthly);
    totalMonthlySpend += monthly;
  }
  totalMonthlySpend = round2(totalMonthlySpend);

  let underBudgetOnAllLimits = false;
  const budgetsWithLimit = budgets.filter((b) => b.limit > 0);
  if (budgetsWithLimit.length > 0) {
    underBudgetOnAllLimits = budgetsWithLimit.every((b) => {
      const spent =
        b.category === "__total__" ? totalMonthlySpend : (spendByCategory.get(b.category) ?? 0);
      return spent <= b.limit;
    });
  }

  const score = computeSubscriptionHealthScore({
    monthlyActiveSpend: activeMonthlyTotal,
    activeSubscriptionCount: subsActive.length,
    pausedSubscriptionCount: pausedCount,
    activeSubsPricePerMonth,
    underBudgetOnAllLimits,
  });

  const activeStarted = subsActive
    .filter((s) => hasSubscriptionStarted(s.startDate, now))
    .map((s) => {
      const base = prismaSubToType(s);
      const u = upcoming.get(s.id);
      return {
        ...base,
        upcomingPrice: u?.upcomingPrice ?? null,
        upcomingPriceEffectiveAt: u?.upcomingPriceEffectiveAt?.toISOString() ?? null,
      };
    });

  const insightCards = buildInsightCards({
    currentMonthlyNormalized: activeMonthlyTotal,
    yearlyProjection,
    categoryBreakdown,
    activeStarted,
    budgets,
    spendByCategory,
    totalMonthlySpend,
  });

  return NextResponse.json({
    plan: "premium",
    advancedAnalyticsLocked: false,
    score,
    hasActiveSubscriptions,
    monthlySpend,
    categoryBreakdown,
    yearlyProjection,
    monthlySubscriptionSpend: activeMonthlyTotal,
    nationalAvgMonthly: US_AVG_MONTHLY_SUBS,
    insightCards,
  });
}
