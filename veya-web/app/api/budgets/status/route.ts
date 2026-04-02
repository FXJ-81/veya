import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { pricePerMonth, hasSubscriptionStarted } from "@/lib/subscriptionBilling";

export type BudgetStatus = {
  id: string;
  category: string;
  limit: number;
  period: string;
  spent: number;
  percentage: number;
  remaining: number;
  status: "under" | "warning" | "over";
};

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [budgets, subs] = await Promise.all([
    prisma.budget.findMany({ where: { userId: authUser.id }, orderBy: { createdAt: "asc" } }),
    prisma.subscription.findMany({
      where: { userId: authUser.id, status: "active" },
      select: { category: true, price: true, billingCycle: true, startDate: true },
    }),
  ]);

  // Monthly spend per category for active subscriptions that have started
  const spendByCategory = new Map<string, number>();
  let totalMonthlySpend = 0;
  for (const sub of subs) {
    if (!hasSubscriptionStarted(new Date(sub.startDate))) continue;
    const monthly = pricePerMonth(sub.price, sub.billingCycle);
    spendByCategory.set(sub.category, (spendByCategory.get(sub.category) ?? 0) + monthly);
    totalMonthlySpend += monthly;
  }

  const statuses: BudgetStatus[] = budgets.map((b) => {
    const spent = b.category === "__total__"
      ? totalMonthlySpend
      : (spendByCategory.get(b.category) ?? 0);
    const percentage = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    const remaining = b.limit - spent;
    const status: BudgetStatus["status"] =
      percentage >= 90 ? "over" : percentage >= 70 ? "warning" : "under";

    return {
      id: b.id,
      category: b.category,
      limit: b.limit,
      period: b.period,
      spent: Number(spent.toFixed(2)),
      percentage: Number(percentage.toFixed(1)),
      remaining: Number(remaining.toFixed(2)),
      status,
    };
  });

  return NextResponse.json({ statuses, totalMonthlySpend: Number(totalMonthlySpend.toFixed(2)) });
}
