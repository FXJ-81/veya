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
  console.log("[login-verify] POST called");
  let body: unknown;
  try { body = await req.json(); } catch {
    console.error("[login-verify] Failed to parse JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error("[login-verify] Validation failed:", parsed.error.errors);
    return NextResponse.json({ error: "Email and 6-digit code required" }, { status: 400 });
  }

  const { email, code } = parsed.data;
  const normalized = code.trim().replace(/\s/g, "");
  console.log("[login-verify] Verifying code for:", email);

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
    console.warn("[login-verify] User not found or 2FA not enabled for:", email);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  console.log("[login-verify] User has code:", !!user.twoFactorCode, "expiry:", user.twoFactorExpiry?.toISOString());

  if (!user.twoFactorCode || !user.twoFactorExpiry) {
    console.warn("[login-verify] No active code in database for:", email);
    return NextResponse.json({ error: "No active code. Request a new one." }, { status: 400 });
  }

  if (user.twoFactorExpiry < new Date()) {
    console.warn("[login-verify] Code expired for:", email, "expiry was:", user.twoFactorExpiry.toISOString());
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: null, twoFactorExpiry: null },
    });
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (user.twoFactorCode !== normalized) {
    console.warn("[login-verify] Code mismatch for:", email, "expected:", user.twoFactorCode, "got:", normalized);
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  console.log("[login-verify] Code matched — clearing and returning success for:", email);
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorCode: null, twoFactorExpiry: null },
  });

  return NextResponse.json({ success: true });
}
