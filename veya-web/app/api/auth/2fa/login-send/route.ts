import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTwoFactorCode } from "@/lib/twoFactorEmail";

const schema = z.object({ email: z.string().email() });

/** Unauthenticated — called during login when 2FA is required */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, twoFactorEnabled: true },
  });

  if (!user) {
    // Don't reveal whether email exists
    return NextResponse.json({ success: true });
  }

  if (!user.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA not enabled for this account" }, { status: 400 });
  }

  const { error } = await sendTwoFactorCode(
    user.id,
    user.email,
    user.name?.split(" ")[0] ?? "there",
    "Your Veya login code"
  );

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
