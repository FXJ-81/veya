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
  return NextResponse.json({
    plan: user.plan,
    stripeCustomerId: null,
  });
}

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.action === "upgrade") {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "premium" },
    });
    return NextResponse.json({ plan: "premium", message: "Upgraded. Stripe integration can be added for payment." });
  }
  return NextResponse.json({ plan: user.plan });
}
