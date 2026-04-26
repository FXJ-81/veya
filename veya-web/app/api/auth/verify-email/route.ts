import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGoogleOAuthOrigin } from "@/lib/googleOAuthCallback";
import { getClientIp, rateLimitAllow } from "@/lib/rateLimitInMemory";

const VERIFY_PREFIX = "verify:";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimitAllow(`auth:verify-email:${ip}`, 40, 60 * 60 * 1000)) {
    return NextResponse.redirect(new URL("/sign-in?error=Too+many+attempts", req.url));
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token?.trim() || token.length > 512) {
    return NextResponse.redirect(new URL("/sign-in?error=Invalid+link", req.url));
  }

  try {
    const verification = await prisma.verificationToken.findUnique({
      where: { token: token.trim() },
    });
    if (!verification || verification.expires < new Date()) {
      return NextResponse.redirect(new URL("/sign-in?error=Link+expired", req.url));
    }
    if (!verification.identifier.startsWith(VERIFY_PREFIX)) {
      return NextResponse.redirect(new URL("/sign-in?error=Invalid+link", req.url));
    }
    const email = verification.identifier.slice(VERIFY_PREFIX.length);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.redirect(new URL("/sign-in?error=Invalid+link", req.url));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
    await prisma.verificationToken.deleteMany({ where: { token: token.trim() } });
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=Something+went+wrong", req.url));
  }

  return NextResponse.redirect(new URL("/sign-in?verified=1", getGoogleOAuthOrigin()));
}
