import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
  "__Host-next-auth.session-token",
] as const;

/** Parse a single cookie value from the Cookie header (avoids `cookies()` which can be null in App Route handlers). */
function getCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === name) {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return null;
}

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieHeader = req.headers.get("cookie");
  let currentToken: string | null = null;
  for (const name of SESSION_COOKIE_NAMES) {
    const v = getCookieFromHeader(cookieHeader, name);
    if (v) {
      currentToken = v;
      break;
    }
  }

  if (currentToken) {
    await prisma.session.deleteMany({
      where: {
        userId: authUser.id,
        sessionToken: { not: currentToken },
      },
    });
  } else {
    await prisma.session.deleteMany({ where: { userId: authUser.id } });
  }

  return NextResponse.json({ ok: true });
}
