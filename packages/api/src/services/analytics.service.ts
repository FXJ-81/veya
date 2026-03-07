import { prisma } from "../prisma/client.js";

export async function getSummary(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "ACTIVE" },
  });
  const monthlyTotal = subs.reduce((sum, s) => {
    const p = Number(s.price);
    if (s.billingCycle === "MONTHLY") return sum + p;
    if (s.billingCycle === "YEARLY") return sum + p / 12;
    if (s.billingCycle === "WEEKLY") return sum + p * 4.33;
    return sum + p;
  }, 0);
  const yearlyProjection = monthlyTotal * 12;
  const activeCount = subs.length;
  const pausedCount = await prisma.subscription.count({
    where: { userId, status: "PAUSED" },
  });
  const avgPerSub = activeCount > 0 ? monthlyTotal / activeCount : 0;
  return {
    monthlySpend: Math.round(monthlyTotal * 100) / 100,
    yearlyProjection: Math.round(yearlyProjection * 100) / 100,
    activeSubscriptions: activeCount,
    pausedSubscriptions: pausedCount,
    avgCostPerSubscription: Math.round(avgPerSub * 100) / 100,
  };
}

export async function getHistory(userId: string, months = 12) {
  const history = await prisma.spendingHistory.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: months,
  });
  return history.map((h) => ({
    month: h.month,
    year: h.year,
    total: Number(h.total),
    breakdownByCategory: h.breakdownByCategory as Record<string, number>,
  }));
}

export async function getCategories(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "ACTIVE" },
  });
  const byCategory: Record<string, number> = {};
  for (const s of subs) {
    const p = Number(s.price);
    let monthly = p;
    if (s.billingCycle === "YEARLY") monthly = p / 12;
    if (s.billingCycle === "WEEKLY") monthly = p * 4.33;
    byCategory[s.category] = (byCategory[s.category] ?? 0) + monthly;
  }
  return Object.entries(byCategory).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

export async function getScore(userId: string): Promise<{ score: number; breakdown: Record<string, number> }> {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { not: "CANCELLED" } },
  });
  const active = subs.filter((s) => s.status === "ACTIVE");
  const variety = Math.min(active.length * 5, 25);
  const wasted = active.length > 10 ? Math.max(0, 25 - (active.length - 10) * 2) : 25;
  const budget = 25;
  const unused = 25;
  const score = Math.min(100, variety + wasted + budget + unused);
  return {
    score: Math.round(score),
    breakdown: { variety, waste: wasted, budgetAdherence: budget, unused: unused },
  };
}

export async function getInsights(userId: string): Promise<string[]> {
  const summary = await getSummary(userId);
  const insights: string[] = [];
  if (summary.monthlySpend > 100) {
    insights.push(`You're spending $${summary.monthlySpend.toFixed(0)}/month on subscriptions. Cancelling 2 could save you $${(summary.monthlySpend * 0.3).toFixed(0)}/month.`);
  }
  if (summary.activeSubscriptions > 8) {
    insights.push(`You have ${summary.activeSubscriptions} active subscriptions. Review which ones you use least.`);
  }
  insights.push(`Your yearly projection is $${summary.yearlyProjection.toFixed(0)}. Small cuts add up.`);
  return insights.slice(0, 5);
}

export async function getHeatmap(userId: string, _year: number) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "ACTIVE" },
  });
  const days: Record<string, number> = {};
  for (const s of subs) {
    const d = s.nextRenewal.toISOString().slice(0, 10);
    const p = Number(s.price);
    days[d] = (days[d] ?? 0) + p;
  }
  return Object.entries(days).map(([date, amount]) => ({ date, amount }));
}
