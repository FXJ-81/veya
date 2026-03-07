import { randomBytes } from "crypto";
import { prisma } from "../prisma/client.js";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function createFamily(userId: string, name: string) {
  const code = generateInviteCode();
  return prisma.family.create({
    data: { name, adminId: userId, inviteCode: code },
    include: { admin: { select: { id: true, name: true, email: true } } },
  });
}

export async function getFamily(id: string, userId: string) {
  const member = await prisma.familyMember.findFirst({
    where: { familyId: id, userId },
    include: { family: { include: { admin: { select: { id: true, name: true, email: true } } } } },
  });
  if (!member) return null;
  return member.family;
}

export async function inviteMember(familyId: string, adminId: string, email: string) {
  const family = await prisma.family.findFirst({ where: { id: familyId, adminId } });
  if (!family) throw new Error("Family not found");
  return { inviteCode: family.inviteCode, email };
}

export async function joinFamily(userId: string, inviteCode: string) {
  const code = inviteCode.trim().toUpperCase();
  const family = await prisma.family.findUnique({ where: { inviteCode: code } });
  if (!family) throw new Error("Invalid invite code");
  const existing = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: family.id, userId } },
  });
  if (existing) return prisma.family.findUnique({ where: { id: family.id } });
  await prisma.familyMember.create({
    data: { familyId: family.id, userId, role: "MEMBER" },
  });
  return prisma.family.findUnique({ where: { id: family.id } });
}

export async function leaveFamily(userId: string) {
  await prisma.familyMember.deleteMany({ where: { userId } });
  return { ok: true };
}

export async function getMembers(familyId: string, userId: string) {
  const member = await prisma.familyMember.findFirst({ where: { familyId, userId } });
  if (!member) return null;
  return prisma.familyMember.findMany({
    where: { familyId },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
}

export async function getSharedSubscriptions(familyId: string, userId: string) {
  const member = await prisma.familyMember.findFirst({ where: { familyId, userId } });
  if (!member) return null;
  return prisma.sharedSubscription.findMany({
    where: { familyId },
    include: { subscription: true },
  });
}
