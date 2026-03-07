import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().optional().transform((s) => (s?.trim() || undefined)),
  email: z.string().email("Invalid email").transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  console.log("[register] POST /api/auth/register hit");
  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[register] Invalid JSON:", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[register] Parsed body keys:", body && typeof body === "object" ? Object.keys(body as object) : "not object");
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    const message = firstError ? firstError.message : parsed.error.message;
    console.error("[register] Validation failed:", parsed.error.errors);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  console.log("[register] Validation OK. email:", email, "name:", name ?? "(empty)");

  try {
    console.log("[register] Step 1: Checking existing user for:", email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log("[register] Email already registered:", email);
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    console.log("[register] Step 2: Hashing password with bcrypt");
    const hashed = await hash(password, 12);
    console.log("[register] Step 2 done: password hashed");

    console.log("[register] Step 3: Creating user in database via Prisma");
    const user = await prisma.user.create({
      data: { name: name ?? null, email, password: hashed },
    });
    console.log("[register] User created:", user.id, user.email);

    // Email verification: send link via SendGrid
    const verifyToken = randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await prisma.verificationToken.deleteMany({
      where: { identifier: `verify:${email}` },
    });
    await prisma.verificationToken.create({
      data: {
        identifier: `verify:${email}`,
        token: verifyToken,
        expires: verifyExpires,
      },
    });
    const apiKey = process.env.SENDGRID_API_KEY;
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const verifyLink = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? "noreply@veya.app";
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      try {
        await sgMail.send({
          to: email,
          from: fromEmail,
          subject: "Verify your Veya email",
          text: `Click to verify your email (link valid 24 hours): ${verifyLink}`,
          html: `
            <p>Thanks for signing up. Click the link below to verify your email:</p>
            <p><a href="${verifyLink}">Verify email</a></p>
            <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
          `,
        });
      } catch (err) {
        console.error("[register] SendGrid verify email error:", err);
        // Still return success; user is created, they can request a new link later if we add that
      }
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      message: "Account created. Check your email to verify before signing in.",
    });
  } catch (e) {
    console.error("[register] Database or server error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
