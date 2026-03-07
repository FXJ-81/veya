import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.subscription.findMany({
    where: { userId: authUser.id, status: "active" },
  });

  const now = new Date();
  const monthlySpend: { month: number; year: number; total: number; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth();
    const year = d.getFullYear();
    let total = 0;
    for (const s of subs) {
      const cycleMonths = s.billingCycle === "yearly" ? 12 : s.billingCycle === "weekly" ? 1 / 4.33 : 1;
      const pricePerMonth = s.billingCycle === "yearly" ? s.price / 12 : s.billingCycle === "weekly" ? s.price * 4.33 : s.price;
      total += pricePerMonth;
    }
    monthlySpend.push({
      month: month + 1,
      year,
      total,
      label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
    });
  }

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const s of subs) {
    const perMonth = s.billingCycle === "yearly" ? s.price / 12 : s.billingCycle === "weekly" ? s.price * 4.33 : s.price;
    const cur = categoryMap.get(s.category) ?? { total: 0, count: 0 };
    cur.total += perMonth;
    cur.count += 1;
    categoryMap.set(s.category, cur);
  }
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, v]) => ({
    category,
    total: Math.round(v.total * 100) / 100,
    count: v.count,
  }));

  const totalThisMonth = monthlySpend[monthlySpend.length - 1]?.total ?? 0;
  const yearlyProjection = totalThisMonth * 12;
  const score = Math.min(100, Math.max(0, Math.round(100 - totalThisMonth * 2)));
  const insights = [
    totalThisMonth > 100 ? `You're spending $${totalThisMonth.toFixed(0)}/mo on subscriptions. Review unused services.` : "Your subscription spend is under control.",
    categoryBreakdown.length > 0 ? `Top category: ${categoryBreakdown[0].category} ($${categoryBreakdown[0].total.toFixed(2)}/mo).` : "Add subscriptions to get insights.",
  ];

  return NextResponse.json({
    score,
    monthlySpend,
    categoryBreakdown,
    yearlyProjection,
    insights,
  });
}
