import { NextResponse } from "next/server";
import {
  AUTHORIZED_GOOGLE_OAUTH_REDIRECT_URIS,
  getGoogleOAuthOrigin,
  getGoogleOAuthRedirectUri,
} from "@/lib/googleOAuthCallback";

/**
 * Dev-only: check that Google OAuth env vars are set and what redirect URI will be used.
 * Open http://localhost:3000/api/auth/debug-google when testing.
 * Remove or protect this route in production.
 */
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const origin = getGoogleOAuthOrigin();
  const redirectUri = getGoogleOAuthRedirectUri();

  const ok = clientId.length > 10 && clientSecret.length > 10;
  return NextResponse.json({
    ok,
    message: ok
      ? "Env vars look set. If Google still says 'client not found', create a NEW Web application client in Google Cloud and use its ID/secret."
      : "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing or too short. Check .env and restart the dev server.",
    GOOGLE_CLIENT_ID_set: clientId.length > 0,
    GOOGLE_CLIENT_ID_startsWith: clientId ? clientId.slice(0, 14) + "..." : "(empty)",
    NEXTAUTH_URL_effective_origin: origin,
    redirect_uri_sent_to_Google: redirectUri,
    authorized_redirect_uris_register_both_in_Google_Cloud: AUTHORIZED_GOOGLE_OAUTH_REDIRECT_URIS,
    checklist: [
      "In Google Cloud, use an OAuth client with Application type = Web application",
      "Authorized redirect URIs must be exactly these two (no other hosts, paths, or ports):",
      ...AUTHORIZED_GOOGLE_OAUTH_REDIRECT_URIS.map((u) => `  - ${u}`),
      `NEXTAUTH_URL must be exactly ${origin} (no trailing slash) so NextAuth matches the same callback.`,
      "Use http://localhost:3000 locally — not 127.0.0.1 or another port.",
      "After changing .env, restart: npm run dev",
    ],
  });
}
