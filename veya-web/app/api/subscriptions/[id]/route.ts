import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { readUpcomingPriceRowsForUser, writeUpcomingPriceForUserSubscription } from "@/lib/subscriptionUpcomingSql";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  upcomingPrice: z.union([z.number().positive(), z.null()]).optional(),
  upcomingPriceEffectiveAt: z.union([z.string().min(1), z.null()]).optional(),
  billingCycle: z.enum(["monthly", "yearly", "weekly", "custom"]).optional(),
  startDate: z.string().optional(),
  nextRenewal: z.string().optional(),
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
  if (p.startDate !== undefined) data.startDate = new Date(p.startDate);
  if (p.nextRenewal !== undefined) data.nextRenewal = new Date(p.nextRenewal);
  if (p.status !== undefined) data.status = p.status;
  if (p.notes !== undefined) data.notes = p.notes;
  if (p.isShared !== undefined) data.isShared = p.isShared;
  if (p.color !== undefined) data.color = p.color;
  const sub = await prisma.subscription.update({
    where: { id },
    data,
  });
  // Upcoming price change: allow setting or clearing via raw SQL (works even if local Prisma client is stale).
  const wantsUpcomingPrice = "upcomingPrice" in p || "upcomingPriceEffectiveAt" in p;
  if (wantsUpcomingPrice) {
    const nextPrice = p.upcomingPrice ?? undefined;
    const nextEff = p.upcomingPriceEffectiveAt ?? undefined;
    let upcomingPrice: number | null | undefined;
    let upcomingPriceEffectiveAt: Date | null | undefined;

    if (nextPrice === null || nextEff === null) {
      upcomingPrice = null;
      upcomingPriceEffectiveAt = null;
    } else if (typeof nextPrice === "number" && typeof nextEff === "string") {
      const effDate = new Date(nextEff);
      if (Number.isNaN(effDate.getTime())) {
        return NextResponse.json({ error: "Invalid upcomingPriceEffectiveAt" }, { status: 400 });
      }
      upcomingPrice = nextPrice;
      upcomingPriceEffectiveAt = effDate;
    } else if (nextPrice !== undefined || nextEff !== undefined) {
      return NextResponse.json(
        { error: "Provide both upcomingPrice and upcomingPriceEffectiveAt, or set both to null to remove." },
        { status: 400 },
      );
    }

    if (upcomingPrice !== undefined && upcomingPriceEffectiveAt !== undefined) {
      await writeUpcomingPriceForUserSubscription(prisma, {
        userId: authUser.id,
        subscriptionId: id,
        upcomingPrice,
        upcomingPriceEffectiveAt,
      });
    }
  }

  const upcoming = (await readUpcomingPriceRowsForUser(prisma, authUser.id, [id]))[0];
  return NextResponse.json({
    ...sub,
    startDate: sub.startDate.toISOString(),
    nextRenewal: sub.nextRenewal.toISOString(),
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
