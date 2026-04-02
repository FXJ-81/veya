import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { limit, category, period } = body as {
    limit?: number;
    category?: string;
    period?: string;
  };

  const existing = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== authUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.budget.update({
    where: { id: params.id },
    data: {
      ...(typeof limit === "number" && limit > 0 ? { limit } : {}),
      ...(category ? { category } : {}),
      ...(period ? { period } : {}),
    },
  });

  return NextResponse.json({ budget: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== authUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.budget.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
