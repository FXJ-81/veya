import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().positive(),
  billingCycle: z.enum(["monthly", "yearly", "weekly", "custom"]),
  startDate: z.string(),
  nextRenewal: z.string(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  notes: z.string().optional(),
  isShared: z.boolean().optional(),
  color: z.string().optional(),
  source: z.enum(["manual", "gmail"]).optional(),
});

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subs = await prisma.subscription.findMany({
    where: { userId: authUser.id },
    orderBy: { nextRenewal: "asc" },
  });
  return NextResponse.json(
    subs.map((s) => ({
      ...s,
      startDate: s.startDate.toISOString(),
      nextRenewal: s.nextRenewal.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
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
  const sub = await prisma.subscription.create({
    data: {
      userId: authUser.id,
      name: data.name,
      category: data.category,
      price: data.price,
      billingCycle: data.billingCycle,
      startDate: new Date(data.startDate),
      nextRenewal: new Date(data.nextRenewal),
      status: data.status ?? "active",
      notes: data.notes,
      isShared: data.isShared ?? false,
      color: data.color,
      source: data.source ?? "manual",
    },
  });
  return NextResponse.json({
    ...sub,
    startDate: sub.startDate.toISOString(),
    nextRenewal: sub.nextRenewal.toISOString(),
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  });
}
