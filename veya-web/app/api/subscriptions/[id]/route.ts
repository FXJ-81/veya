import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { readUpcomingPriceRowsForUser, writeUpcomingPriceForUserSubscription } from "@/lib/subscriptionUpcomingSql";
import { parseSubscriptionCalendarDateInput } from "@/lib/subscriptionBilling";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  upcomingPrice: z.union([z.number().positive(), z.null()]).optional(),
  upcomingPriceEffectiveAt: z.union([z.string().min(1), z.null()]).optional(),
  billingCycle: z.enum(["monthly", "yearly", "weekly", "custom"]).optional(),
  startDate: z.string().optional(),
  nextRenewal: z.string().optional(),
  planEndsAt: z.union([z.string(), z.null()]).optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  notes: z.string().optional(),
  isShared: z.boolean().optional(),
  color: z.string().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sub = await prisma.subscription.findFirst({
    where: { id, userId: authUser.id },
  });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const upcoming = (await readUpcomingPriceRowsForUser(prisma, authUser.id, [id]))[0];
  return NextResponse.json({
    ...sub,
    startDate: sub.startDate.toISOString(),
    nextRenewal: sub.nextRenewal.toISOString(),
    planEndsAt: sub.planEndsAt?.toISOString() ?? null,
    upcomingPrice: upcoming?.upcomingPrice ?? null,
    upcomingPriceEffectiveAt: upcoming?.upcomingPriceEffectiveAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const existing = await prisma.subscription.findFirst({
    where: { id, userId: authUser.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = parsed.data;
  const data: Prisma.SubscriptionUpdateInput = {};
  if (p.name !== undefined) data.name = p.name;
  if (p.category !== undefined) data.category = p.category;
  if (p.price !== undefined) data.price = p.price;
  if (p.billingCycle !== undefined) data.billingCycle = p.billingCycle;
  if (p.startDate !== undefined) data.startDate = parseSubscriptionCalendarDateInput(p.startDate);
  if (p.nextRenewal !== undefined) data.nextRenewal = parseSubscriptionCalendarDateInput(p.nextRenewal);
  if ("planEndsAt" in p) {
    if (p.planEndsAt === null || (typeof p.planEndsAt === "string" && !p.planEndsAt.trim())) {
      data.planEndsAt = null;
    } else if (typeof p.planEndsAt === "string") {
      data.planEndsAt = parseSubscriptionCalendarDateInput(p.planEndsAt.trim());
    }
  }
  if (p.status !== undefined) data.status = p.status;
  if (p.notes !== undefined) data.notes = p.notes;
  if (p.isShared !== undefined) data.isShared = p.isShared;
  if (p.color !== undefined) data.color = p.color;
  const sub =
    Object.keys(data).length > 0
      ? await prisma.subscription.update({ where: { id }, data })
      : await prisma.subscription.findFirstOrThrow({ where: { id, userId: authUser.id } });
  // Upcoming price change: allow setting or clearing via raw SQL (works even if local Prisma client is stale).
  const wantsUpcomingPrice = "upcomingPrice" in p || "upcomingPriceEffectiveAt" in p;
  if (wantsUpcomingPrice) {
    const nextPrice = p.upcomingPrice;
    const nextEff = p.upcomingPriceEffectiveAt;

    if (nextPrice === null && nextEff === null) {
      await writeUpcomingPriceForUserSubscription(prisma, {
        userId: authUser.id,
        subscriptionId: id,
        upcomingPrice: null,
        upcomingPriceEffectiveAt: null,
      });
    } else if (typeof nextPrice === "number" && typeof nextEff === "string" && nextEff.trim().length > 0) {
      const effDate = parseSubscriptionCalendarDateInput(nextEff.trim());
      if (Number.isNaN(effDate.getTime())) {
        return NextResponse.json({ error: "Invalid upcomingPriceEffectiveAt" }, { status: 400 });
      }
      await writeUpcomingPriceForUserSubscription(prisma, {
        userId: authUser.id,
        subscriptionId: id,
        upcomingPrice: nextPrice,
        upcomingPriceEffectiveAt: effDate,
      });
    } else {
      return NextResponse.json(
        { error: "Provide both upcomingPrice and upcomingPriceEffectiveAt, or set both to null to remove." },
        { status: 400 },
      );
    }
  }

  const upcoming = (await readUpcomingPriceRowsForUser(prisma, authUser.id, [id]))[0];
  return NextResponse.json({
    ...sub,
    startDate: sub.startDate.toISOString(),
    nextRenewal: sub.nextRenewal.toISOString(),
    planEndsAt: sub.planEndsAt?.toISOString() ?? null,
    upcomingPrice: upcoming?.upcomingPrice ?? null,
    upcomingPriceEffectiveAt: upcoming?.upcomingPriceEffectiveAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.subscription.findFirst({
    where: { id, userId: authUser.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.subscription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
