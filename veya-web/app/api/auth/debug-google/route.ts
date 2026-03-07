import { NextResponse } from "next/server";

/**
 * Dev-only: check that Google OAuth env vars are set and what redirect URI will be used.
 * Open http://localhost:3000/api/auth/debug-google when testing.
 * Remove or protect this route in production.
 */
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/callback/google`;

  const ok = clientId.length > 10 && clientSecret.length > 10;
  return NextResponse.json({
    ok,
    message: ok
      ? "Env vars look set. If Google still says 'client not found', create a NEW Web application client in Google Cloud and use its ID/secret."
      : "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing or too short. Check .env and restart the dev server.",
    GOOGLE_CLIENT_ID_set: clientId.length > 0,
    GOOGLE_CLIENT_ID_startsWith: clientId ? clientId.slice(0, 14) + "..." : "(empty)",
    NEXTAUTH_URL: baseUrl,
    redirect_uri_sent_to_Google: redirectUri,
    checklist: [
      "In Google Cloud, use a OAuth client with Application type = Web application",
      "In that client, Authorized redirect URIs must contain exactly: " + redirectUri,
      "Open your app at " + baseUrl + " (same as NEXTAUTH_URL), not 127.0.0.1 or another port",
      "After changing .env, restart: npm run dev",
    ],
  });
}
