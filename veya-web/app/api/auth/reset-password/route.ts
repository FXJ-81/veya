import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimitAllow } from "@/lib/rateLimitInMemory";

const schema = z.object({
  token: z.string().min(1).max(256),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimitAllow(`auth:reset-password:${ip}`, 40, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const verification = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!verification || verification.expires < new Date()) {
    return NextResponse.json({ error: "Invalid or expired reset link. Request a new one." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: verification.identifier },
  });
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const hashedPassword = await hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });
  await prisma.verificationToken.deleteMany({
    where: { token },
  });

  return NextResponse.json({ message: "Password updated. You can sign in now." });
}
