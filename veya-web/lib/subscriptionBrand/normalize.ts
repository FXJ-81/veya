/**
 * Normalize merchant / subscription names for brand matching.
 * Handles statement noise (SQ*, PayPal*, Apple/Google billing patterns, etc.).
 */

/** Collapse spaces, strip diacritics/punctuation for fuzzy merchant matching. */
export function normalizeSubscriptionNameForMatch(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, "");

  // Path-like billing descriptors → tokens (APPLE.COM/BILL, NETFLIX.COM CA)
  s = s.replace(/[/\\]+/g, " ");

  // Common card / ACH / wallet prefixes (case-insensitive)
  s = s.replace(
    /\b(sq\*?|tst\*?|paypal\*?|venmo\*?|zelle\*?|cashapp\*?|cash app|google\s*\*+|goog\*|gco\*|apple\s*bill|apple\.com\s*bill|amzn|amzn mkp|amazon pay|amazon web services|aws)\b/gi,
    (m) => {
      const t = m.toLowerCase().replace(/\s+/g, "");
      if (t.includes("amzn") || t.includes("amazon")) return " amazon ";
      if (t.includes("apple")) return " apple ";
      if (t.includes("goog") || t.startsWith("gco")) return " google ";
      return " ";
    },
  );

  s = s.replace(/\*+/g, " ");
  // Keep +, ., - for domains (netflix.com) and Disney+
  s = s.replace(/[^a-z0-9+&.\s-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Normalize plus variants
  s = s.replace(/\bdisney\s*\+\b/gi, "disney+ ");
  s = s.replace(/\bparamount\s*\+\b/gi, "paramount+ ");

  return s.replace(/\s+/g, " ").trim();
}
