import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convo = await prisma.aIConversation.findFirst({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
  });

  const messages = (convo?.messages as unknown) ?? [];
  return NextResponse.json({ messages });
}

export async function DELETE(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.aIConversation.deleteMany({
    where: { userId: authUser.id },
  });

  return NextResponse.json({ ok: true });
}

