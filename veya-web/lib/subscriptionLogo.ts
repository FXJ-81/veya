/**
 * Clearbit logos + name→domain fallbacks when `logoUrl` is missing or broken.
 * Order: longer phrases first so "YouTube Premium" wins over "Google".
 */

const NAME_TO_DOMAIN_ENTRIES: [string, string][] = [
  ["youtube premium", "youtube.com"],
  ["google one", "google.com"],
  ["chatgpt plus", "openai.com"],
  ["icloud+", "apple.com"],
  ["icloud", "apple.com"],
  ["apple one", "apple.com"],
  ["linkedin premium", "linkedin.com"],
  ["microsoft 365", "microsoft.com"],
  ["adobe creative cloud", "adobe.com"],
  ["amazon prime", "amazon.com"],
  ["disney+", "disneyplus.com"],
  ["disney plus", "disneyplus.com"],
  ["github pro", "github.com"],
  ["claude pro", "anthropic.com"],
  ["apple", "apple.com"],
  ["netflix", "netflix.com"],
  ["spotify", "spotify.com"],
  ["openai", "openai.com"],
  ["anthropic", "anthropic.com"],
  ["claude", "anthropic.com"],
  ["google", "google.com"],
  ["amazon", "amazon.com"],
  ["microsoft", "microsoft.com"],
  ["adobe", "adobe.com"],
  ["dropbox", "dropbox.com"],
  ["github", "github.com"],
  ["notion", "notion.so"],
  ["hulu", "hulu.com"],
  ["duolingo", "duolingo.com"],
  ["linkedin", "linkedin.com"],
];

export function domainForSubscriptionName(name: string): string | null {
  const n = name.trim().toLowerCase();
  for (const [needle, domain] of NAME_TO_DOMAIN_ENTRIES) {
    if (n === needle || n.includes(needle)) return domain;
  }
  return null;
}

export function clearbitLogoUrlForDomain(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

/** Prefer stored URL; else Clearbit from mapped domain. */
export function resolveSubscriptionLogoUrl(
  name: string,
  storedLogoUrl: string | null | undefined
): string | null {
  if (storedLogoUrl?.trim().startsWith("http")) {
    return storedLogoUrl.trim();
  }
  const domain = domainForSubscriptionName(name);
  if (!domain) return null;
  return clearbitLogoUrlForDomain(domain);
}

/** Stable hue 0–360 for fallback avatar ring */
export function accentHueForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 17)) % 360;
  }
  return h;
}
