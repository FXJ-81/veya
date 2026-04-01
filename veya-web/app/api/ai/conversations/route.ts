import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

function deriveTitle(messages: unknown): string {
  if (!Array.isArray(messages)) return "New chat";
  const first = messages.find(
    (m: unknown) =>
      m &&
      typeof m === "object" &&
      (m as Record<string, unknown>).role === "user" &&
      typeof (m as Record<string, unknown>).content === "string" &&
      ((m as Record<string, unknown>).content as string).trim().length > 0
  ) as Record<string, unknown> | undefined;
  if (!first) return "New chat";
  const raw = (first.content as string).trim();
  return raw.length <= 35 ? raw : `${raw.slice(0, 35).trimEnd()}...`;
}

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.aIConversation.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, messages: true, createdAt: true },
  });

  const conversations = rows.map((row) => ({
    id: row.id,
    title: deriveTitle(row.messages),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.createdAt.toISOString(),
  }));

  console.log("[GET /api/ai/conversations] userId:", authUser.id, "count:", conversations.length);

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.aIConversation.create({
    data: { userId: authUser.id, messages: [] },
    select: { id: true, createdAt: true },
  });

  console.log("[POST /api/ai/conversations] created:", row.id);

  return NextResponse.json({
    conversation: {
      id: row.id,
      title: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.createdAt.toISOString(),
    },
  });
}
