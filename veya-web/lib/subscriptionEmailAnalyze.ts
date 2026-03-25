import OpenAI from "openai";
import {
  DOMAIN_CATALOG,
  clearbitLogoUrl,
  normalizeSenderDomain,
} from "@/lib/knownSubscriptionDomains";

export const SUBSCRIPTION_KEYWORD_RE =
  /receipt|invoice|charge|payment|subscription|billing|order\s*confirmation|renewal|renewed|auto-?pay|membership/i;

/** Extract display name from From header before < */
export function extractSenderDisplayName(fromHeader: string): string {
  const m = fromHeader.match(/^([^<]+)</);
  if (m) return m[1].replace(/"/g, "").trim();
  const at = fromHeader.indexOf("@");
  if (at === -1) return fromHeader.trim();
  return fromHeader.split("@")[0]?.trim() || fromHeader.trim();
}

export function extractEmailDomain(fromHeader: string): string | null {
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : fromHeader;
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/** Dollar amounts from subject + body (common receipt phrasing). */
export function extractPricesFromText(text: string): number[] {
  const amounts = new Set<number>();

  const patterns = [
    /\$\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/g,
    /(?:charged|payment\s+of|total\s*:|amount\s*:|billed)\s*\$?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = (m[1] ?? "").replace(/,/g, "");
      const val = parseFloat(raw);
      if (val > 0 && val < 50_000) amounts.add(Math.round(val * 100) / 100);
    }
  }

  return [...amounts].sort((a, b) => a - b);
}

export function pickReasonablePrice(amounts: number[], catalogHint?: number): number {
  if (amounts.length === 0) return 0;
  if (catalogHint && amounts.some((a) => Math.abs(a - catalogHint) < 0.5)) {
    return catalogHint;
  }
  const monthlyLike = amounts.filter((a) => a >= 0.99 && a <= 499);
  if (monthlyLike.length) return monthlyLike[0];
  return amounts[0];
}

export function inferBillingCycle(text: string, amount: number): "monthly" | "yearly" | "weekly" {
  const t = text.toLowerCase();
  if (/\b(annual|yearly|per year|\/year|\/yr|one[-\s]?year|12[-\s]?month)\b/.test(t)) {
    return "yearly";
  }
  if (/\b(weekly|per week|\/week)\b/.test(t)) {
    return "weekly";
  }
  if (amount >= 0.99 && amount <= 3.99 && !/\b(annual|yearly)\b/.test(t)) {
    return "monthly";
  }
  return "monthly";
}

export function parseDateFromEmail(
  text: string,
  internalDateMs: number | undefined
): { nextRenewal: string; startDate: string } {
  if (internalDateMs) {
    return formatPair(new Date(internalDateMs));
  }
  const fallback = new Date();
  const normalized = text.toLowerCase().replace(/\s+/g, " ");

  const isoLike = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoLike) {
    const d = new Date(`${isoLike[1]}-${isoLike[2]}-${isoLike[3]}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return formatPair(d);
    }
  }

  const slash = normalized.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (slash) {
    let y = parseInt(slash[3], 10);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(slash[1], 10) - 1, parseInt(slash[2], 10));
    if (!Number.isNaN(d.getTime())) {
      return formatPair(d);
    }
  }

  return formatPair(fallback);
}

function formatPair(next: Date): { nextRenewal: string; startDate: string } {
  const start = new Date(next.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    nextRenewal: next.toISOString().slice(0, 10),
    startDate: start.toISOString().slice(0, 10),
  };
}

export function resolveServiceNameAndCategory(
  catalogDomain: string,
  subject: string,
  body: string
): { name: string; category: string } {
  const text = `${subject}\n${body}`.toLowerCase();
  const entry = DOMAIN_CATALOG[catalogDomain];

  if (catalogDomain === "apple.com") {
    if (/\bapple\s*one\b/.test(text)) {
      return { name: "Apple One", category: "Storage" };
    }
    if (/\bicloud\+|\bicloud\b/.test(text)) {
      return { name: "iCloud+", category: "Storage" };
    }
    return { name: entry?.defaultName ?? "Apple Services", category: entry?.category ?? "Storage" };
  }

  if (catalogDomain === "google.com") {
    if (/\byoutube\s*premium\b|\byoutube\s*music\b/.test(text)) {
      return { name: "YouTube Premium", category: "Streaming" };
    }
    if (/\bgoogle\s*one\b/.test(text)) {
      return { name: "Google One", category: "Storage" };
    }
    return { name: entry?.defaultName ?? "Google One", category: entry?.category ?? "Storage" };
  }

  if (catalogDomain === "amazon.com") {
    return { name: "Amazon Prime", category: "Shopping" };
  }

  return {
    name: entry?.defaultName ?? catalogDomain.split(".")[0] ?? "Subscription",
    category: entry?.category ?? "Other",
  };
}

let openaiClient: OpenAI | null | undefined;

function getOpenAI(): OpenAI | null {
  if (openaiClient !== undefined) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  openaiClient = key ? new OpenAI({ apiKey: key }) : null;
  return openaiClient;
}

export async function analyzeUnclearSubscriptionEmail(
  subject: string,
  bodyStart: string
): Promise<{ name: string; price: number; billingCycle: string; category: string } | null> {
  const client = getOpenAI();
  if (!client) return null;

  const snippet = bodyStart.slice(0, 200);
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Is this a subscription receipt? If yes return JSON only: {"name","price","billingCycle","category"} where billingCycle is monthly|yearly|weekly. If not a subscription return null.
Subject: ${subject}
Body (start): ${snippet}`,
        },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? "";
    if (!raw || raw === "null" || raw.toLowerCase() === "null") return null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      name?: string;
      price?: number;
      billingCycle?: string;
      category?: string;
    };
    if (!parsed.name || typeof parsed.price !== "number") return null;
    const cycle =
      parsed.billingCycle === "yearly" || parsed.billingCycle === "weekly"
        ? parsed.billingCycle
        : "monthly";
    return {
      name: parsed.name,
      price: parsed.price,
      billingCycle: cycle,
      category: parsed.category ?? "Other",
    };
  } catch {
    return null;
  }
}

export function buildLogoUrlForDomain(fromDomain: string): string {
  const root = normalizeSenderDomain(fromDomain) ?? fromDomain;
  return clearbitLogoUrl(root);
}
