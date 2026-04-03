/**
 * NextAuth + Google callback path.
 */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/callback/google" as const;

const LOCAL_ORIGIN = "http://localhost:3000" as const;

function trimOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Ensure NEXTAUTH_URL is set to the *current deployment host* when missing.
 * Never force to a different host, otherwise OAuth state/callback cookies can mismatch.
 */
export function applyCanonicalNextAuthUrlForOAuth(): void {
  const raw = trimOrigin(process.env.NEXTAUTH_URL ?? "");
  if (raw) {
    const parsed = parseOrigin(raw);
    if (parsed) {
      process.env.NEXTAUTH_URL = parsed;
      return;
    }
    console.error("[google-oauth] Invalid NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const inferred = `https://${vercelUrl}`;
    process.env.NEXTAUTH_URL = inferred;
    console.warn("[google-oauth] NEXTAUTH_URL missing; inferred from VERCEL_URL:", inferred);
    return;
  }

  process.env.NEXTAUTH_URL = LOCAL_ORIGIN;
  console.warn("[google-oauth] NEXTAUTH_URL missing; defaulting to local:", LOCAL_ORIGIN);
}

/**
 * Origin only (no path).
 */
export function getGoogleOAuthOrigin(): string {
  applyCanonicalNextAuthUrlForOAuth();
  return trimOrigin(process.env.NEXTAUTH_URL ?? LOCAL_ORIGIN);
}

/** Full redirect URI passed to google.auth.OAuth2. */
export function getGoogleOAuthRedirectUri(): string {
  return `${getGoogleOAuthOrigin()}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

/** Helpful for debug endpoint / docs; includes local + current effective host. */
export function getAuthorizedGoogleOAuthRedirectUris(): string[] {
  const current = getGoogleOAuthRedirectUri();
  const local = `${LOCAL_ORIGIN}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  return Array.from(new Set([local, current]));
}
