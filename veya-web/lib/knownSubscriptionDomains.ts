/** Root domains we treat as known subscription senders (Clearbit logos use apex domain). */
export const KNOWN_SUBSCRIPTION_DOMAINS = [
  "openai.com",
  "apple.com",
  "netflix.com",
  "spotify.com",
  "google.com",
  "amazon.com",
  "hulu.com",
  "disneyplus.com",
  "microsoft.com",
  "adobe.com",
  "dropbox.com",
  "notion.so",
  "github.com",
  "linkedin.com",
  "duolingo.com",
  "nytimes.com",
  "claude.ai",
  "anthropic.com",
] as const;

export type KnownDomain = (typeof KNOWN_SUBSCRIPTION_DOMAINS)[number];

export interface DomainCatalogEntry {
  defaultName: string;
  category: string;
  /** Typical monthly price hint for display when unknown (optional) */
  priceHint?: number;
}

export const DOMAIN_CATALOG: Record<string, DomainCatalogEntry> = {
  "openai.com": { defaultName: "ChatGPT Plus", category: "Productivity", priceHint: 20 },
  "apple.com": { defaultName: "iCloud+", category: "Storage" },
  "netflix.com": { defaultName: "Netflix", category: "Streaming" },
  "spotify.com": { defaultName: "Spotify", category: "Music" },
  "google.com": { defaultName: "Google One", category: "Storage" },
  "amazon.com": { defaultName: "Amazon Prime", category: "Shopping" },
  "hulu.com": { defaultName: "Hulu", category: "Streaming" },
  "disneyplus.com": { defaultName: "Disney+", category: "Streaming" },
  "microsoft.com": { defaultName: "Microsoft 365", category: "Productivity" },
  "adobe.com": { defaultName: "Adobe", category: "Productivity" },
  "dropbox.com": { defaultName: "Dropbox", category: "Storage" },
  "notion.so": { defaultName: "Notion", category: "Productivity" },
  "github.com": { defaultName: "GitHub", category: "Productivity" },
  "linkedin.com": { defaultName: "LinkedIn Premium", category: "Productivity" },
  "duolingo.com": { defaultName: "Duolingo", category: "Education" },
  "nytimes.com": { defaultName: "NYT", category: "News" },
  "claude.ai": { defaultName: "Claude", category: "Productivity" },
  "anthropic.com": { defaultName: "Claude", category: "Productivity" },
};

/** Map subdomains / variants to catalog root domain. */
export function normalizeSenderDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase();
  if (!d) return null;
  if (d.endsWith("apple.com") || d === "email.apple.com" || d.includes(".apple.com")) {
    return "apple.com";
  }
  if (d.endsWith("google.com") || d.endsWith("googlemail.com") || d.endsWith("gmail.com")) {
    return "google.com";
  }
  if (d.endsWith("amazon.com") || d.endsWith("amazon.co.uk")) {
    return "amazon.com";
  }
  if (d.endsWith("notion.so")) {
    return "notion.so";
  }
  if (d.endsWith("openai.com")) {
    return "openai.com";
  }
  if (d.endsWith("anthropic.com")) {
    return "anthropic.com";
  }
  if (d.endsWith("claude.ai")) {
    return "claude.ai";
  }
  if (d.endsWith("nytimes.com")) {
    return "nytimes.com";
  }
  if (d.endsWith("linkedin.com")) {
    return "linkedin.com";
  }
  if (d.endsWith("github.com")) {
    return "github.com";
  }
  if (d.endsWith("dropbox.com")) {
    return "dropbox.com";
  }
  if (d.endsWith("adobe.com")) {
    return "adobe.com";
  }
  if (d.endsWith("microsoft.com")) {
    return "microsoft.com";
  }
  if (d.endsWith("disneyplus.com")) {
    return "disneyplus.com";
  }
  if (d.endsWith("hulu.com")) {
    return "hulu.com";
  }
  if (d.endsWith("spotify.com")) {
    return "spotify.com";
  }
  if (d.endsWith("netflix.com")) {
    return "netflix.com";
  }
  if (d.endsWith("duolingo.com")) {
    return "duolingo.com";
  }
  return d;
}

export function clearbitLogoUrl(domain: string): string {
  const apex = normalizeSenderDomain(domain) ?? domain;
  return `https://logo.clearbit.com/${apex}`;
}
