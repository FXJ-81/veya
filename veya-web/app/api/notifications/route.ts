import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { sentAt: "desc" },
    take: 50,
  });
  return NextResponse.json(
    notifications.map((n) => ({
      ...n,
      sentAt: n.sentAt.toISOString(),
    }))
  );
}

export async function PATCH(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: { id?: string; read?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: user.id },
      data: { read: body.read ?? true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: user.id },
      data: { read: true },
    });
  }
  return NextResponse.json({ ok: true });
}
