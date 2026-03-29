/**
 * Google OAuth "Authorized redirect URIs" for this app must be exactly these two — no other format.
 * NextAuth uses the same path: /api/auth/callback/google
 */

export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/callback/google" as const;

const LOCAL_ORIGIN = "http://localhost:3000" as const;
const PROD_ORIGIN = "https://veya-beta.vercel.app" as const;

export const GOOGLE_OAUTH_REDIRECT_URI_LOCAL = `${LOCAL_ORIGIN}${GOOGLE_OAUTH_CALLBACK_PATH}`;
export const GOOGLE_OAUTH_REDIRECT_URI_PROD = `${PROD_ORIGIN}${GOOGLE_OAUTH_CALLBACK_PATH}`;

/** Register both in Google Cloud Console → OAuth client → Authorized redirect URIs */
export const AUTHORIZED_GOOGLE_OAUTH_REDIRECT_URIS: readonly string[] = [
  GOOGLE_OAUTH_REDIRECT_URI_LOCAL,
  GOOGLE_OAUTH_REDIRECT_URI_PROD,
];

/**
 * Origin only (no path) — must be LOCAL_ORIGIN or PROD_ORIGIN so the callback URL stays standard.
 */
export function getGoogleOAuthOrigin(): typeof LOCAL_ORIGIN | typeof PROD_ORIGIN {
  const raw = process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, "") ?? "";
  if (raw === PROD_ORIGIN) return PROD_ORIGIN;
  if (raw === LOCAL_ORIGIN) return LOCAL_ORIGIN;
  if (process.env.VERCEL_ENV === "production") return PROD_ORIGIN;
  return LOCAL_ORIGIN;
}

/** Full redirect URI passed to google.auth.OAuth2 — always one of the two allowed URLs above. */
export function getGoogleOAuthRedirectUri(): string {
  return `${getGoogleOAuthOrigin()}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}
