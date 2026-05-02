import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createSubscriptionForUser } from "@/lib/subscriptionCreateInternal";
import { getSubscriptionLimitStatus, planLimitResponse } from "@/lib/planLimits";
import { readUpcomingPriceRowsForUser, upcomingPriceMap } from "@/lib/subscriptionUpcomingSql";
import { parseSubscriptionCalendarDateInput } from "@/lib/subscriptionBilling";

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().positive(),
  billingCycle: z.enum(["monthly", "yearly", "weekly", "custom"]),
  startDate: z.string(),
  nextRenewal: z.string(),
  planEndsAt: z.union([z.string(), z.null()]).optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  notes: z.string().optional(),
  isShared: z.boolean().optional(),
  color: z.string().optional(),
  source: z.enum(["manual", "gmail", "plaid"]).optional(),
});

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subs = await prisma.subscription.findMany({
    where: { userId: authUser.id },
    orderBy: { nextRenewal: "asc" },
  });
  const upcoming = upcomingPriceMap(await readUpcomingPriceRowsForUser(prisma, authUser.id, subs.map((s) => s.id)));
  const limitStatus = await getSubscriptionLimitStatus(authUser.id);
  return NextResponse.json({
    subscriptions: subs.map((s) => ({
      ...s,
      startDate: s.startDate.toISOString(),
      nextRenewal: s.nextRenewal.toISOString(),
      planEndsAt: s.planEndsAt?.toISOString() ?? null,
      upcomingPrice: upcoming.get(s.id)?.upcomingPrice ?? null,
      upcomingPriceEffectiveAt: upcoming.get(s.id)?.upcomingPriceEffectiveAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    plan: limitStatus.plan,
    subscriptionLimit: limitStatus.limit,
    subscriptionCount: limitStatus.count,
    subscriptionRemaining: limitStatus.remaining,
  });
}

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const data = parsed.data;
  let sub: Awaited<ReturnType<typeof createSubscriptionForUser>>;
  try {
    sub = await createSubscriptionForUser(authUser.id, {
      name: data.name,
      category: data.category,
      price: data.price,
      billingCycle: data.billingCycle,
      startDate: parseSubscriptionCalendarDateInput(data.startDate),
      nextRenewal: parseSubscriptionCalendarDateInput(data.nextRenewal),
      planEndsAt: (() => {
        const v = data.planEndsAt;
        if (v === undefined || v === null) return undefined;
        const t = v.trim();
        return t === "" ? null : parseSubscriptionCalendarDateInput(t);
      })(),
      status: data.status ?? "active",
      notes: data.notes,
      isShared: data.isShared ?? false,
      color: data.color,
      source: data.source ?? "manual",
    });
  } catch (e) {
    const limit = planLimitResponse(e);
    if (limit) return limit;
    throw e;
  }

  return NextResponse.json({
    ...sub,
    startDate: sub.startDate.toISOString(),
    nextRenewal: sub.nextRenewal.toISOString(),
    planEndsAt: sub.planEndsAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  });
}
