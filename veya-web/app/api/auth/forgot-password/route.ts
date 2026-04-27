import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getGoogleOAuthOrigin } from "@/lib/googleOAuthCallback";
import { getClientIp, rateLimitAllow } from "@/lib/rateLimitInMemory";
import { sendPasswordResetEmail } from "@/lib/authEmails";

const RESET_EXPIRY_HOURS = 1;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimitAllow(`auth:forgot:${ip}`, 25, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim();
  if (!email || email.length > 320) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const emailKey = email.toLowerCase();
  if (!rateLimitAllow(`auth:forgot:email:${emailKey}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  if (!process.env.SENDGRID_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Email not configured. Set SENDGRID_API_KEY." },
      { status: 503 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  // Always return the same response so attackers can't enumerate accounts.
  const genericMessage = { message: "If an account exists, we sent a reset link." };

  if (!user || !user.password) {
    return NextResponse.json(genericMessage);
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
  await prisma.verificationToken.create({
    data: { identifier: user.email, token, expires },
  });

  const baseUrl = getGoogleOAuthOrigin();
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  if (!process.env.SENDGRID_FROM_EMAIL?.trim() && !process.env.EMAIL_FROM?.trim()) {
    console.warn(
      "[forgot-password] SENDGRID_FROM_EMAIL is not set. SendGrid requires a verified sender.",
    );
  }

  await sendPasswordResetEmail({
    to: user.email,
    recipientName: user.name,
    resetLink,
    expiresInHours: RESET_EXPIRY_HOURS,
  });

  return NextResponse.json(genericMessage);
}
