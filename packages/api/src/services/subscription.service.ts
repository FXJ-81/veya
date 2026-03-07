import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

const FREE_SUB_LIMIT = 10;

export async function getSubscriptions(userId: string, plan: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    orderBy: { nextRenewal: "asc" },
    include: { alternative: true },
  });
  if (plan === "FREE" && subs.length > FREE_SUB_LIMIT) {
    return subs.slice(0, FREE_SUB_LIMIT);
  }
  return subs;
}

export async function getSubscriptionById(id: string, userId: string) {
  return prisma.subscription.findFirst({
    where: { id, userId },
    include: { alternative: true },
  });
}

export interface CreateSubInput {
  name: string;
  category: string;
  price: number;
  billingCycle: "MONTHLY" | "YEARLY" | "WEEKLY" | "CUSTOM";
  startDate: Date;
  nextRenewal: Date;
  notes?: string;
  logoUrl?: string;
  color?: string;
}

export async function createSubscription(userId: string, data: CreateSubInput) {
  const count = await prisma.subscription.count({ where: { userId, status: { not: "CANCELLED" } } });
  if (count >= FREE_SUB_LIMIT) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (user?.plan !== "PREMIUM") {
      throw new Error("Free tier limited to 10 subscriptions. Upgrade to Premium for unlimited.");
    }
  }
  return prisma.subscription.create({
    data: {
      userId,
      name: data.name,
      category: data.category,
      price: data.price,
      billingCycle: data.billingCycle,
      startDate: data.startDate,
      nextRenewal: data.nextRenewal,
      notes: data.notes,
      logoUrl: data.logoUrl,
      color: data.color,
    },
  });
}

export async function updateSubscription(id: string, userId: string, data: Partial<{
  name: string;
  category: string;
  price: number;
  billingCycle: string;
  nextRenewal: Date;
  notes: string;
  logoUrl: string;
  color: string;
}>) {
  await prisma.subscription.findFirstOrThrow({ where: { id, userId } });
  return prisma.subscription.update({
    where: { id },
    data: data as Prisma.SubscriptionUpdateInput,
  });
}

export async function deleteSubscription(id: string, userId: string) {
  await prisma.subscription.findFirstOrThrow({ where: { id, userId } });
  return prisma.subscription.delete({ where: { id } });
}

export async function pauseSubscription(id: string, userId: string) {
  await prisma.subscription.findFirstOrThrow({ where: { id, userId } });
  return prisma.subscription.update({
    where: { id },
    data: { status: "PAUSED" },
  });
}

export async function resumeSubscription(id: string, userId: string) {
  await prisma.subscription.findFirstOrThrow({ where: { id, userId } });
  return prisma.subscription.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
}

export async function getAlternative(subscriptionId: string, userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    include: { alternative: true },
  });
  return sub?.alternative ?? null;
}
