import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  code: z.string().min(1),
});

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const normalized = parsed.data.code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      twoFactorCode: true,
      twoFactorExpiry: true,
      twoFactorEnabled: true,
    },
  });

  if (!user?.twoFactorCode || !user.twoFactorExpiry) {
    return NextResponse.json({ error: "No active code. Request a new one." }, { status: 400 });
  }

  if (user.twoFactorExpiry < new Date()) {
    await prisma.user.update({
      where: { id: authUser.id },
      data: { twoFactorCode: null, twoFactorExpiry: null },
    });
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (user.twoFactorCode !== normalized) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const wasEnabled = user.twoFactorEnabled;
  const nextEnabled = !wasEnabled;

  await prisma.user.update({
    where: { id: authUser.id },
    data: {
      twoFactorCode: null,
      twoFactorExpiry: null,
      twoFactorEnabled: nextEnabled,
    },
  });

  return NextResponse.json({ success: true, twoFactorEnabled: nextEnabled });
}
