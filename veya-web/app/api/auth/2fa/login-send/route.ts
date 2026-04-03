import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTwoFactorCode } from "@/lib/twoFactorEmail";

const schema = z.object({ email: z.string().email() });

/** Unauthenticated — called during login when 2FA is required */
export async function POST(req: Request) {
  console.log("[login-send] POST called");
  let body: unknown;
  try { body = await req.json(); } catch {
    console.error("[login-send] Failed to parse JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error("[login-send] Validation failed:", parsed.error.errors);
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  console.log("[login-send] Looking up user:", email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, twoFactorEnabled: true },
  });

  if (!user) {
    console.log("[login-send] User not found:", email);
    // Don't reveal whether email exists
    return NextResponse.json({ success: true });
  }

  console.log("[login-send] User found, twoFactorEnabled:", user.twoFactorEnabled);

  if (!user.twoFactorEnabled) {
    console.warn("[login-send] 2FA not enabled for user:", email);
    return NextResponse.json({ error: "2FA not enabled for this account" }, { status: 400 });
  }

  console.log("[login-send] Sending 2FA code to:", user.email);
  const { error } = await sendTwoFactorCode(
    user.id,
    user.email,
    user.name?.split(" ")[0] ?? "there",
    "Your Veya login code"
  );

  if (error) {
    console.error("[login-send] sendTwoFactorCode returned error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  console.log("[login-send] Code sent successfully to:", user.email);
  return NextResponse.json({ success: true });
}
