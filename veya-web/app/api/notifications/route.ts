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
