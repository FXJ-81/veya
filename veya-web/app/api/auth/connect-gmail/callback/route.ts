import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("connect_gmail_state")?.value;
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/subscriptions?error=Invalid+callback", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }
  // Clear state cookie
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/connect-gmail/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/subscriptions?error=Gmail+not+configured", baseUrl));
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[connect-gmail] token exchange failed:", err);
    return NextResponse.redirect(new URL("/subscriptions?error=Could+not+connect", baseUrl));
  }
  const tokens = await tokenRes.json();
  const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
  if (!user) {
    return NextResponse.redirect(new URL("/subscriptions?error=User+not+found", baseUrl));
  }
  const expiresAt = tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null;
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google-gmail",
        providerAccountId: user.email,
      },
    },
    create: {
      userId: user.id,
      type: "oauth",
      provider: "google-gmail",
      providerAccountId: user.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      token_type: tokens.token_type ?? "Bearer",
      scope: tokens.scope ?? null,
    },
    update: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? undefined,
      expires_at: expiresAt,
      scope: tokens.scope ?? undefined,
    },
  });

  const res = NextResponse.redirect(new URL("/dashboard?gmail_connected=1", baseUrl));
  res.cookies.set("connect_gmail_state", "", { maxAge: 0, path: "/" });
  return res;
}
