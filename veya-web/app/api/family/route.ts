import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const membership = await prisma.familyMember.findFirst({
    where: { userId: user.id },
    include: { family: { include: { members: { include: { user: true } } } } },
  });
  if (!membership) {
    return NextResponse.json({ family: null, members: [], totalMonthlySpend: 0 });
  }

  const familyUserIds = membership.family.members.map((m) => m.userId);
  const subs = await prisma.subscription.findMany({
    where: { userId: { in: familyUserIds }, status: "active" },
  });
  const totalMonthlySpend = subs.reduce((sum, s) => {
    const perMonth = s.billingCycle === "yearly" ? s.price / 12 : s.billingCycle === "weekly" ? s.price * 4.33 : s.price;
    return sum + perMonth;
  }, 0);

  return NextResponse.json({
    family: {
      id: membership.family.id,
      name: membership.family.name,
      inviteCode: membership.family.inviteCode,
      adminId: membership.family.adminId,
    },
    members: membership.family.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
    totalMonthlySpend: Math.round(totalMonthlySpend * 100) / 100,
  });
}

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.familyMember.findFirst({
    where: { userId: user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "Already in a family" }, { status: 400 });
  }

  let body: { name?: string; inviteCode?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.inviteCode) {
    const family = await prisma.family.findUnique({
      where: { inviteCode: body.inviteCode },
    });
    if (!family) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    await prisma.familyMember.create({
      data: { familyId: family.id, userId: user.id, role: "member" },
    });
    return NextResponse.json({ joined: true, familyId: family.id });
  }

  const inviteCode = randomBytes(4).toString("hex");
  const family = await prisma.family.create({
    data: {
      name: body.name ?? `${user.name ?? "User"}'s Family`,
      adminId: user.id,
      inviteCode,
    },
  });
  await prisma.familyMember.create({
    data: { familyId: family.id, userId: user.id, role: "admin" },
  });
  return NextResponse.json({
    family: { id: family.id, name: family.name, inviteCode: family.inviteCode },
  });
}
