import type { Transaction } from "plaid";
import OpenAI from "openai";
import { WEEKS_PER_MONTH } from "@/lib/subscriptionBilling";

export type PlaidDetectedSubscription = {
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly" | "custom";
  category: string;
  lastCharged: string;
  confidence: "high" | "medium";
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VALID_CATEGORIES = new Set([
  "Streaming", "Music", "Productivity", "Storage", "Gaming",
  "Education", "News", "Health", "Food", "Shopping", "Transport",
  "Travel", "Finance", "Utilities", "Entertainment", "AI", "Other",
]);

// In-memory cache — avoids duplicate OpenAI calls within the same process
const categoryCache = new Map<string, string>();

async function categoryForMerchantAI(name: string): Promise<string> {
  const key = name.toLowerCase().trim();
  if (categoryCache.has(key)) return categoryCache.get(key)!;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content:
            `What category does this subscription/merchant belong to? ` +
            `Merchant name: ${name}. ` +
            `Reply with ONLY one of these exact words: ` +
            `Streaming, Music, Productivity, Storage, Gaming, Education, ` +
            `News, Health, Food, Shopping, Transport, Travel, Finance, ` +
            `Utilities, Entertainment, AI, Other`,
        },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? "";
    const category = VALID_CATEGORIES.has(raw) ? raw : "Other";
    categoryCache.set(key, category);
    return category;
  } catch {
    categoryCache.set(key, "Other");
    return "Other";
  }
}

const KNOWN = [
  "netflix", "spotify", "apple", "google", "amazon prime", "hulu",
  "disney", "youtube", "microsoft", "adobe", "dropbox", "github",
  "openai", "anthropic", "notion", "linkedin", "duolingo", "nyt",
  "new york times", "chatgpt", "icloud", "peacock", "paramount",
  "espn", "hbo", "xbox", "playstation", "nintendo", "calm",
  "headspace", "peloton",
];

function normalizeMerchant(tx: Transaction): string {
  const raw = (tx.merchant_name ?? tx.name ?? "").trim();
  return raw || "Unknown";
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();
}

function isKnownMerchant(name: string): boolean {
  const k = normalizeKey(name);
  return KNOWN.some((svc) => k.includes(svc) || svc.includes(k));
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function classifyCycle(daysBetween: number): "monthly" | "yearly" | "weekly" | "custom" {
  if (daysBetween >= 25 && daysBetween <= 35) return "monthly";
  if (daysBetween >= 6 && daysBetween <= 9) return "weekly";
  if (daysBetween >= 340 && daysBetween <= 400) return "yearly";
  return "custom";
}

function toMonthlyAmount(amount: number, cycle: "monthly" | "yearly" | "weekly" | "custom"): number {
  switch (cycle) {
    case "yearly": return amount / 12;
    case "weekly": return amount * WEEKS_PER_MONTH;
    case "custom":
    case "monthly":
    default: return amount;
  }
}

export async function detectSubscriptionsFromPlaidTransactions(
  transactions: Transaction[]
): Promise<PlaidDetectedSubscription[]> {
  const settled = transactions.filter((t) => !t.pending);
  const byMerchant = new Map<string, Transaction[]>();

  for (const t of settled) {
    const name = normalizeMerchant(t);
    if (!name || name === "Unknown") continue;
    const amt = Math.abs(Number(t.amount ?? 0));
    if (amt <= 0) continue;
    const pfc = t.personal_finance_category;
    const primary = pfc?.primary?.toUpperCase() ?? "";
    if (primary === "TRANSFER" || primary === "LOAN_PAYMENTS") continue;

    const list = byMerchant.get(name) ?? [];
    list.push(t);
    byMerchant.set(name, list);
  }

  // Build candidate list (category placeholder — filled in after AI calls)
  const out: PlaidDetectedSubscription[] = [];

  for (const [merchant, txs] of byMerchant) {
    if (txs.length < 2 && !isKnownMerchant(merchant)) continue;

    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const last = sorted[sorted.length - 1]!;
    const lastCharged = last.date;
    const known = isKnownMerchant(merchant);

    if (sorted.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const d0 = new Date(sorted[i - 1]!.date).getTime();
        const d1 = new Date(sorted[i]!.date).getTime();
        const days = Math.round((d1 - d0) / (86400 * 1000));
        if (days > 0 && days < 400) diffs.push(days);
      }
      const medDays = median(diffs);
      const cycle = classifyCycle(medDays);
      const amounts = sorted.map((t) => Math.abs(Number(t.amount)));
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const monthlyPrice = Number(toMonthlyAmount(avg, cycle).toFixed(2));
      const confidence: "high" | "medium" = known || sorted.length >= 3 ? "high" : "medium";

      out.push({
        name: merchant,
        price: monthlyPrice,
        billingCycle: cycle === "custom" ? "monthly" : cycle,
        category: "Other", // filled in below
        lastCharged,
        confidence,
      });
      continue;
    }

    if (known && sorted.length === 1) {
      out.push({
        name: merchant,
        price: Number(Math.abs(Number(last.amount)).toFixed(2)),
        billingCycle: "monthly",
        category: "Other", // filled in below
        lastCharged,
        confidence: "medium",
      });
    }
  }

  // Categorize all unique merchants in parallel (cached so no duplicate calls)
  const uniqueMerchants = [...new Set(out.map((s) => s.name))];
  await Promise.all(uniqueMerchants.map((m) => categoryForMerchantAI(m)));

  // Assign AI-determined categories
  for (const sub of out) {
    sub.category = categoryCache.get(sub.name.toLowerCase().trim()) ?? "Other";
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
