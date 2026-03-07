import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  billingCycle: z.enum(["monthly", "yearly", "weekly"]).optional(),
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
  return NextResponse.json({
    ...sub,
    startDate: sub.startDate.toISOString(),
    nextRenewal: sub.nextRenewal.toISOString(),
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
  const data = parsed.data as Record<string, unknown>;
  if (data.startDate) data.startDate = new Date(data.startDate as string);
  if (data.nextRenewal) data.nextRenewal = new Date(data.nextRenewal as string);
  const sub = await prisma.subscription.update({
    where: { id },
    data,
  });
  return NextResponse.json({
    ...sub,
    startDate: sub.startDate.toISOString(),
    nextRenewal: sub.nextRenewal.toISOString(),
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
