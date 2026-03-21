import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import {
  computeSubscriptionHealthScore,
  hasSubscriptionStarted,
  monthlySpendInCalendarMonth,
  pricePerMonth,
} from "@/lib/subscriptionBilling";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /** Active only: paused excluded from all months; future projections = active only (per product spec). */
  const subs = await prisma.subscription.findMany({
    where: { userId: authUser.id, status: "active" },
  });

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

    for (const s of subs) {
      const raw = monthlySpendInCalendarMonth(
        { startDate: s.startDate, price: s.price, billingCycle: s.billingCycle },
        year,
        monthIndex
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
  for (const s of subs) {
    const perMonth = pricePerMonth(s.price, s.billingCycle);
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

  /** Normalized monthly burn for subs that have started by today (matches dashboard). */
  const currentMonthlyNormalized = round2(
    subs
      .filter((s) => hasSubscriptionStarted(s.startDate, now))
      .reduce((sum, s) => sum + pricePerMonth(s.price, s.billingCycle), 0)
  );

  const yearlyProjection = round2(currentMonthlyNormalized * 12);

  const hasActiveSubscriptions = subs.length > 0;

  const score = computeSubscriptionHealthScore(
    subs.map((s) => ({
      price: s.price,
      billingCycle: s.billingCycle,
      category: s.category,
    })),
    currentMonthlyNormalized
  );

  const insights = [
    currentMonthlyNormalized > 100
      ? `You're spending $${currentMonthlyNormalized.toFixed(0)}/mo on subscriptions. Review unused services.`
      : "Your subscription spend is under control.",
    categoryBreakdown.length > 0
      ? `Top category: ${categoryBreakdown[0].category} ($${categoryBreakdown[0].total.toFixed(2)}/mo).`
      : "Add subscriptions to get insights.",
  ];

  return NextResponse.json({
    score,
    hasActiveSubscriptions,
    monthlySpend,
    categoryBreakdown,
    yearlyProjection,
    insights,
  });
}
