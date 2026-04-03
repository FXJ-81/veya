import { NextResponse } from "next/server";
import { z } from "zod";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Unauthenticated endpoint that verifies credentials WITHOUT creating a session.
 * Used by the sign-in page to check password + 2FA status before calling signIn().
 *
 * Returns:
 *   { valid: false }                        – wrong email or password
 *   { valid: true, twoFactorEnabled: false } – correct, no 2FA, proceed with signIn()
 *   { valid: true, twoFactorEnabled: true }  – correct, 2FA required, send code first
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.error("[preflight] Failed to parse request body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error("[preflight] Validation failed:", parsed.error.errors);
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const normalized = email.trim().toLowerCase();

  console.log("[preflight] Looking up user:", normalized);

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, password: true, twoFactorEnabled: true },
  });

  if (!user?.password) {
    console.log("[preflight] User not found or has no password:", normalized);
    // Return same response to avoid email enumeration
    return NextResponse.json({ valid: false });
  }

  const passwordMatch = await compare(password, user.password);
  if (!passwordMatch) {
    console.log("[preflight] Password mismatch for:", normalized);
    return NextResponse.json({ valid: false });
  }

  console.log("[preflight] Valid credentials for:", normalized, "| 2FA enabled:", user.twoFactorEnabled);
  return NextResponse.json({
    valid: true,
    twoFactorEnabled: user.twoFactorEnabled,
  });
}
