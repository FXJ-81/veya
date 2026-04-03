import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const putSchema = z.object({
  renewalReminders: z.boolean().optional(),
  budgetAlerts: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  newSubDetected: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
});

async function ensureSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSettings(authUser.id);
  const s = await prisma.userSettings.findUnique({ where: { userId: authUser.id } });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { password: true },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    renewalReminders: s.renewalReminders,
    budgetAlerts: s.budgetAlerts,
    weeklyDigest: s.weeklyDigest,
    newSubDetected: s.newSubDetected,
    priceAlerts: s.priceAlerts,
    hasPassword: !!user?.password,
  });
}

export async function PUT(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  const data = parsed.data;
  const keys = Object.keys(data) as (keyof typeof data)[];
  if (keys.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await ensureSettings(authUser.id);
  const updated = await prisma.userSettings.update({
    where: { userId: authUser.id },
    data,
  });

  return NextResponse.json({
    renewalReminders: updated.renewalReminders,
    budgetAlerts: updated.budgetAlerts,
    weeklyDigest: updated.weeklyDigest,
    newSubDetected: updated.newSubDetected,
    priceAlerts: updated.priceAlerts,
  });
}
