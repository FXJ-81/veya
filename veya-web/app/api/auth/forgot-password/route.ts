import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";

const RESET_EXPIRY_HOURS = 1;

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email not configured. Set SENDGRID_API_KEY." },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ message: "If an account exists, we sent a reset link." });
  }

  if (!user.password) {
    return NextResponse.json({ message: "If an account exists, we sent a reset link." });
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? "noreply@veya.app";

  sgMail.setApiKey(apiKey);
  try {
    await sgMail.send({
      to: email,
      from: fromEmail,
      subject: "Reset your Veya password",
      text: `Use this link to reset your password (valid ${RESET_EXPIRY_HOURS} hour): ${resetLink}`,
      html: `
        <p>Use the link below to reset your password. It expires in ${RESET_EXPIRY_HOURS} hour.</p>
        <p><a href="${resetLink}">Reset password</a></p>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error("SendGrid error:", err);
    return NextResponse.json(
      { error: "Failed to send email. Try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "If an account exists, we sent a reset link." });
}
