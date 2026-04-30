/**
 * Canonical site origin for absolute metadata (Open Graph, etc.).
 * Set `NEXT_PUBLIC_APP_URL` in production (e.g. https://veya.app).
 */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      /* fall through */
    }
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}
