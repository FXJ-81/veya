import {
  extractPricesFromText,
  inferBillingCycle,
  parseDateFromEmail,
  extractEmailDomain,
} from "@/lib/subscriptionEmailAnalyze";

export interface DiscoverSuggestion {
  name: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly";
  nextRenewal: string;
  startDate: string;
  logoUrl?: string;
}

const KNOWN_SERVICES: { name: string; category: string }[] = [
  { name: "netflix", category: "Streaming" },
  { name: "spotify", category: "Music" },
  { name: "disney+", category: "Streaming" },
  { name: "disney plus", category: "Streaming" },
  { name: "hulu", category: "Streaming" },
  { name: "hbo max", category: "Streaming" },
  { name: "max streaming", category: "Streaming" },
  { name: "amazon prime", category: "Shopping" },
  { name: "prime video", category: "Streaming" },
  { name: "apple tv", category: "Streaming" },
  { name: "apple music", category: "Music" },
  { name: "youtube premium", category: "Streaming" },
  { name: "youtube music", category: "Music" },
  { name: "adobe", category: "Productivity" },
  { name: "microsoft 365", category: "Productivity" },
  { name: "office 365", category: "Productivity" },
  { name: "google one", category: "Storage" },
  { name: "dropbox", category: "Storage" },
  { name: "icloud", category: "Storage" },
  { name: "notion", category: "Productivity" },
  { name: "chatgpt", category: "AI" },
  { name: "openai", category: "AI" },
  { name: "github", category: "Productivity" },
  { name: "figma", category: "Productivity" },
  { name: "canva", category: "Productivity" },
  { name: "linkedin premium", category: "Productivity" },
  { name: "audible", category: "Entertainment" },
  { name: "xbox", category: "Gaming" },
  { name: "playstation", category: "Gaming" },
  { name: "nintendo", category: "Gaming" },
  { name: "gym", category: "Health" },
  { name: "peloton", category: "Health" },
  { name: "headspace", category: "Health" },
  { name: "calm", category: "Health" },
];

function titleCaseDomainFallback(domain: string): string {
  const part = domain.split(".")[0] ?? domain;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/** Legacy bulk parser for manual discover API (pasted text). */
export function parseSubscriptionEmailText(text: string): DiscoverSuggestion[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const suggestions: DiscoverSuggestion[] = [];
  const seen = new Set<string>();

  const amounts = extractPricesFromText(text);
  const billingCycle = inferBillingCycle(normalized, amounts[0] ?? 9.99);
  const { nextRenewal, startDate } = parseDateFromEmail(text, undefined);

  const price = amounts.length > 0 ? Math.min(...amounts) : 0;

  for (const { name: key, category } of KNOWN_SERVICES) {
    if (normalized.includes(key) && !seen.has(key)) {
      seen.add(key);
      const displayName = key
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(" Plus", "+")
        .trim();
      suggestions.push({
        name: displayName,
        category,
        price: price || 9.99,
        billingCycle,
        nextRenewal,
        startDate,
      });
    }
  }

  if (amounts.length > 0 && suggestions.length === 0) {
    const fromLine = text.match(/From:\s*([^\n]+)/i)?.[1] ?? "";
    const dom = extractEmailDomain(fromLine);
    const fallbackName = dom ? titleCaseDomainFallback(dom) : "Detected subscription";
    suggestions.push({
      name: fallbackName,
      category: "Other",
      price: amounts[0],
      billingCycle,
      nextRenewal,
      startDate,
    });
  }

  return suggestions;
}
