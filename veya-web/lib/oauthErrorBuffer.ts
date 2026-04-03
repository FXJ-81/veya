/**
 * Captures the last OAuth adapter / callback failure server-side so the
 * sign-in page can show a real message in development (NextAuth only
 * redirects with ?error=Callback for most thrown errors).
 */
let lastDetail: string | null = null;

export function recordOAuthError(source: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const line = `${source}: ${msg}`;
  console.error("[auth][oauth-error]", line);
  if (process.env.NODE_ENV === "development") {
    lastDetail = line;
  }
}

/** Returns and clears the buffered message (call once per failed redirect). */
export function consumeLastOAuthError(): string | null {
  const v = lastDetail;
  lastDetail = null;
  return v;
}

/** Peek without clearing (optional diagnostics). */
export function peekLastOAuthError(): string | null {
  return lastDetail;
}
