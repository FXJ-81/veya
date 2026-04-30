/**
 * Brand logos from domain + normalized name→domain when `logoUrl` is missing.
 *
 * Note: `logo.clearbit.com` commonly returns **403** in browsers now, so we use
 * Google's public favicon endpoint instead (reliable for well-known domains).
 *
 * Order: longer / more specific phrases first (e.g. "uber eats" before "uber").
 */

/** Collapse spaces, strip diacritics/punctuation for fuzzy merchant matching. */
export function normalizeSubscriptionNameForMatch(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "");

  // Strip common card/statement noise so "SQ *STARBUCKS STORE" still matches "starbucks"
  s = s.replace(/\b(sq|sq\*|tst\*|paypal\*|paypal|venmo\*|venmo|apple\s+bill|google\s+\*)\s*\*?\s*/gi, " ");
  s = s.replace(/\*+/g, " ");
  s = s.replace(/[^a-z0-9+&. ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const NAME_TO_DOMAIN_ENTRIES: [string, string][] = [
  ["youtube premium", "youtube.com"],
  ["youtube tv", "youtube.com"],
  ["youtube music", "youtube.com"],
  ["google one", "google.com"],
  ["google workspace", "google.com"],
  ["google storage", "google.com"],
  ["chatgpt plus", "openai.com"],
  ["chatgpt team", "openai.com"],
  ["openai api", "openai.com"],
  ["icloud+", "apple.com"],
  ["icloud", "apple.com"],
  ["apple one", "apple.com"],
  ["apple music", "apple.com"],
  ["apple tv", "apple.com"],
  ["apple arcade", "apple.com"],
  ["apple news", "apple.com"],
  ["linkedin premium", "linkedin.com"],
  ["linkedin sales", "linkedin.com"],
  ["microsoft 365", "microsoft.com"],
  ["office 365", "microsoft.com"],
  ["xbox game pass", "xbox.com"],
  ["playstation plus", "playstation.com"],
  ["nintendo switch online", "nintendo.com"],
  ["adobe creative cloud", "adobe.com"],
  ["amazon prime video", "amazon.com"],
  ["amazon prime", "amazon.com"],
  ["prime video", "amazon.com"],
  ["audible", "audible.com"],
  ["disney+", "disneyplus.com"],
  ["disney plus", "disneyplus.com"],
  ["hbo max", "max.com"],
  ["max streaming", "max.com"],
  ["peacock", "peacocktv.com"],
  ["paramount+", "paramountplus.com"],
  ["paramount plus", "paramountplus.com"],
  ["github copilot", "github.com"],
  ["github pro", "github.com"],
  ["claude pro", "anthropic.com"],
  ["uber eats", "ubereats.com"],
  ["ubereats", "ubereats.com"],
  ["uber trip", "uber.com"],
  ["uber ride", "uber.com"],
  ["lyft", "lyft.com"],
  ["doordash", "doordash.com"],
  ["instacart", "instacart.com"],
  ["grubhub", "grubhub.com"],
  ["starbucks", "starbucks.com"],
  ["mcdonalds", "mcdonalds.com"],
  ["mcdonald", "mcdonalds.com"],
  ["chipotle", "chipotle.com"],
  ["netflix", "netflix.com"],
  ["hulu", "hulu.com"],
  ["spotify", "spotify.com"],
  ["slack", "slack.com"],
  ["zoom", "zoom.us"],
  ["notion", "notion.so"],
  ["figma", "figma.com"],
  ["canva", "canva.com"],
  ["twitch", "twitch.tv"],
  ["jetbrains", "jetbrains.com"],
  ["dropbox", "dropbox.com"],
  ["1password", "1password.com"],
  ["lastpass", "lastpass.com"],
  ["dashlane", "dashlane.com"],
  ["expressvpn", "expressvpn.com"],
  ["nordvpn", "nordvpn.com"],
  ["surfshark", "surfshark.com"],
  ["grammarly", "grammarly.com"],
  ["duolingo", "duolingo.com"],
  ["headspace", "headspace.com"],
  ["calm", "calm.com"],
  ["peloton", "onepeloton.com"],
  ["strava", "strava.com"],
  ["whoop", "whoop.com"],
  ["openai", "openai.com"],
  ["anthropic", "anthropic.com"],
  ["claude", "anthropic.com"],
  ["apple", "apple.com"],
  ["google", "google.com"],
  ["amazon", "amazon.com"],
  ["microsoft", "microsoft.com"],
  ["adobe", "adobe.com"],
  ["github", "github.com"],
  ["uber", "uber.com"],
  ["linkedin", "linkedin.com"],
];

export function domainForSubscriptionName(name: string): string | null {
  const n = normalizeSubscriptionNameForMatch(name);
  if (!n) return null;
  for (const [needle, domain] of NAME_TO_DOMAIN_ENTRIES) {
    const key = needle.toLowerCase();
    if (n === key || n.includes(key)) return domain;
  }
  return null;
}

/** Public favicon image for a domain (replaces legacy Clearbit URLs that often 403). */
export function brandLogoUrlForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/** @deprecated Use `brandLogoUrlForDomain`; kept for any external imports. */
export function clearbitLogoUrlForDomain(domain: string): string {
  return brandLogoUrlForDomain(domain);
}

/** Prefer a working stored URL; never prefer legacy Clearbit (often 403 in browsers). */
export function resolveSubscriptionLogoUrl(
  name: string,
  storedLogoUrl: string | null | undefined,
): string | null {
  const trimmed = storedLogoUrl?.trim();
  if (trimmed?.startsWith("http")) {
    const clearbitHost = trimmed.includes("logo.clearbit.com");
    if (clearbitHost) {
      const fromPath = trimmed.match(/logo\.clearbit\.com\/([^/?#]+)/i)?.[1];
      if (fromPath) return brandLogoUrlForDomain(decodeURIComponent(fromPath));
      const fromName = domainForSubscriptionName(name);
      if (fromName) return brandLogoUrlForDomain(fromName);
    } else {
      return trimmed;
    }
  }
  const domain = domainForSubscriptionName(name);
  if (!domain) return null;
  return brandLogoUrlForDomain(domain);
}

/** Stable hue 0–360 for fallback avatar ring */
export function accentHueForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 17)) % 360;
  }
  return h;
}
