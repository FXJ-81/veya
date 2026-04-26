import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type UserPlan = "free" | "premium";

export const FREE_SUBSCRIPTION_LIMIT = 10;
export const FREE_DAILY_AI_MESSAGE_LIMIT = 5;

export class PlanLimitError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 403) {
    super(message);
    this.name = "PlanLimitError";
    this.code = code;
    this.status = status;
  }
}

export function normalizePlan(plan: string | null | undefined): UserPlan {
  return plan === "premium" ? "premium" : "free";
}

export function isPremiumPlan(plan: string | null | undefined): boolean {
  return normalizePlan(plan) === "premium";
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return normalizePlan(user?.plan);
}

export async function requirePremiumFeature(
  userId: string,
  featureName: string,
): Promise<NextResponse | null> {
  const plan = await getUserPlan(userId);
  if (plan === "premium") return null;
  return NextResponse.json(
    {
      error: `${featureName} is available on Premium. Upgrade to unlock this feature.`,
      code: "PREMIUM_REQUIRED",
      plan,
    },
    { status: 403 },
  );
}

export async function getSubscriptionLimitStatus(userId: string) {
  const [plan, count] = await Promise.all([
    getUserPlan(userId),
    prisma.subscription.count({
      where: { userId, status: { in: ["active", "paused"] } },
    }),
  ]);

  if (plan === "premium") {
    return { plan, count, limit: null, remaining: null, canCreate: true };
  }

  const remaining = Math.max(0, FREE_SUBSCRIPTION_LIMIT - count);
  return {
    plan,
    count,
    limit: FREE_SUBSCRIPTION_LIMIT,
    remaining,
    canCreate: remaining > 0,
  };
}

export async function assertCanCreateSubscription(userId: string): Promise<void> {
  const status = await getSubscriptionLimitStatus(userId);
  if (status.canCreate) return;

  throw new PlanLimitError(
    `Free accounts can track up to ${FREE_SUBSCRIPTION_LIMIT} subscriptions. Upgrade to Premium for unlimited subscriptions.`,
    "SUBSCRIPTION_LIMIT_REACHED",
    403,
  );
}

function currentUtcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function consumeAiMessageForPlan(userId: string) {
  const plan = await getUserPlan(userId);
  if (plan === "premium") {
    return {
      plan,
      limit: null,
      used: null,
      remaining: null,
    };
  }

  const day = currentUtcDayKey();
  const now = new Date();
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AiMessageUsage" ("id", "userId", "day", "count", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${day}, 1, ${now}, ${now})
    ON CONFLICT ("userId", "day")
    DO UPDATE SET
      "count" = "AiMessageUsage"."count" + 1,
      "updatedAt" = ${now}
    WHERE "AiMessageUsage"."count" < ${FREE_DAILY_AI_MESSAGE_LIMIT}
    RETURNING "count"
  `;

  const used = rows[0]?.count;
  if (!used) {
    throw new PlanLimitError(
      `You've reached the Free plan limit of ${FREE_DAILY_AI_MESSAGE_LIMIT} AI messages today. Upgrade to Premium for unlimited AI Coach access.`,
      "AI_DAILY_LIMIT_REACHED",
      429,
    );
  }

  return {
    plan,
    limit: FREE_DAILY_AI_MESSAGE_LIMIT,
    used,
    remaining: Math.max(0, FREE_DAILY_AI_MESSAGE_LIMIT - used),
  };
}

export function planLimitResponse(error: unknown): NextResponse | null {
  if (!(error instanceof PlanLimitError)) return null;
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
    },
    { status: error.status },
  );
}
