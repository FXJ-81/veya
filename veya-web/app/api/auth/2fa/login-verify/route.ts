import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

/**
 * Verifies the login-time 2FA code.
 * Returns { success: true } so the client can then call signIn("credentials", {...})
 * with redirect:false. The credentials provider already verified the password; this
 * is the second factor gate — if the code is wrong we refuse before the session is created.
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and 6-digit code required" }, { status: 400 });
  }

  const { email, code } = parsed.data;
  const normalized = code.trim().replace(/\s/g, "");

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      twoFactorCode: true,
      twoFactorExpiry: true,
      twoFactorEnabled: true,
    },
  });

  if (!user || !user.twoFactorEnabled) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!user.twoFactorCode || !user.twoFactorExpiry) {
    return NextResponse.json({ error: "No active code. Request a new one." }, { status: 400 });
  }

  if (user.twoFactorExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: null, twoFactorExpiry: null },
    });
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (user.twoFactorCode !== normalized) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorCode: null, twoFactorExpiry: null },
  });

  return NextResponse.json({ success: true });
}
