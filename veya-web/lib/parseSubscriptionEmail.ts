export interface DiscoverSuggestion {
  name: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly";
  nextRenewal: string;
  startDate: string;
}

const KNOWN_SERVICES: { name: string; category: string }[] = [
  { name: "netflix", category: "Streaming" },
  { name: "spotify", category: "Streaming" },
  { name: "disney+", category: "Streaming" },
  { name: "disney plus", category: "Streaming" },
  { name: "hulu", category: "Streaming" },
  { name: "hbo max", category: "Streaming" },
  { name: "max streaming", category: "Streaming" },
  { name: "amazon prime", category: "Streaming" },
  { name: "prime video", category: "Streaming" },
  { name: "apple tv", category: "Streaming" },
  { name: "apple music", category: "Streaming" },
  { name: "youtube premium", category: "Streaming" },
  { name: "youtube music", category: "Streaming" },
  { name: "adobe", category: "Software" },
  { name: "microsoft 365", category: "Software" },
  { name: "office 365", category: "Software" },
  { name: "google one", category: "Cloud" },
  { name: "dropbox", category: "Cloud" },
  { name: "icloud", category: "Cloud" },
  { name: "notion", category: "Software" },
  { name: "chatgpt", category: "Software" },
  { name: "openai", category: "Software" },
  { name: "github", category: "Software" },
  { name: "figma", category: "Software" },
  { name: "canva", category: "Software" },
  { name: "linkedin premium", category: "Software" },
  { name: "audible", category: "Streaming" },
  { name: "xbox", category: "Gaming" },
  { name: "playstation", category: "Gaming" },
  { name: "nintendo", category: "Gaming" },
  { name: "gym", category: "Fitness" },
  { name: "peloton", category: "Fitness" },
  { name: "headspace", category: "Fitness" },
  { name: "calm", category: "Fitness" },
];

export function parseSubscriptionEmailText(text: string): DiscoverSuggestion[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const suggestions: DiscoverSuggestion[] = [];
  const seen = new Set<string>();

  const amounts: number[] = [];
  const priceMatches = [
    ...normalized.matchAll(/(?:[\$£€])\s*(\d+(?:\.\d{2})?)/g),
    ...normalized.matchAll(/(\d+(?:\.\d{2})?)\s*(?:\/month|\/mo|per month|usd|eur)/g),
    ...normalized.matchAll(/(?:^|\s)(\d+\.\d{2})(?:\s|$|\/|,)/g),
  ];
  for (const m of priceMatches) {
    const val = parseFloat(m[1] || "0");
    if (val > 0 && val < 10000) amounts.push(val);
  }

  const isYearly = /\b(annual|yearly|per year|\/year|\/yr|once a year)\b/.test(normalized);
  const isWeekly = /\b(weekly|per week|\/week)\b/.test(normalized);
  const billingCycle: "monthly" | "yearly" | "weekly" = isWeekly ? "weekly" : isYearly ? "yearly" : "monthly";

  let nextRenewal = new Date();
  const dateMatch = normalized.match(
    /(?:renewal|billing|next charge|on)\s*(?:(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?)/i
  );
  if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
    const y = dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3], 10) : parseInt(dateMatch[3], 10);
    nextRenewal.setFullYear(y);
    nextRenewal.setMonth(parseInt(dateMatch[1], 10) - 1);
    nextRenewal.setDate(parseInt(dateMatch[2], 10));
  }
  const nextRenewalStr = nextRenewal.toISOString().slice(0, 10);
  const startDateStr = new Date(nextRenewal.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
        nextRenewal: nextRenewalStr,
        startDate: startDateStr,
      });
    }
  }

  if (amounts.length > 0 && suggestions.length === 0) {
    suggestions.push({
      name: "Subscription from email",
      category: "Other",
      price: amounts[0],
      billingCycle,
      nextRenewal: nextRenewalStr,
      startDate: startDateStr,
    });
  }

  return suggestions;
}
