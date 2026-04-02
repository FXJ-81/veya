import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const budgets = await prisma.budget.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ budgets });
}

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { category, limit, period = "monthly" } = body as {
    category?: string;
    limit?: number;
    period?: string;
  };

  if (!category || typeof limit !== "number" || limit <= 0) {
    return NextResponse.json({ error: "category and a positive limit are required" }, { status: 400 });
  }

  const budget = await prisma.budget.create({
    data: { userId: authUser.id, category, limit, period },
  });

  return NextResponse.json({ budget }, { status: 201 });
}
