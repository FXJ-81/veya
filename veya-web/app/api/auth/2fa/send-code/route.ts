import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const EXPIRY_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email not configured. Set SENDGRID_API_KEY." },
      { status: 503 }
    );
  }

  const code = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorCode: code,
      twoFactorExpiry: expires,
    },
  });

  const fromEmail = (process.env.SENDGRID_FROM_EMAIL || "").trim() || "noreply@veya.app";
  if (!process.env.SENDGRID_FROM_EMAIL?.trim()) {
    console.warn("[2fa/send-code] SENDGRID_FROM_EMAIL is not set.");
  }

  sgMail.setApiKey(apiKey);
  try {
    await sgMail.send({
      to: user.email,
      from: fromEmail,
      subject: "Your Veya verification code",
      text: `Your code is: ${code}\nExpires in 10 minutes.`,
      html: `<p>Your code is: <strong>${code}</strong></p><p>Expires in 10 minutes.</p>`,
    });
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { body?: { errors?: unknown } } }).response?.body?.errors
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[2fa/send-code] SendGrid error:", msg || err);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: isDev && msg ? `Email failed: ${JSON.stringify(msg)}` : "Failed to send email. Try again later.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
