import type { Transaction } from "plaid";
import { WEEKS_PER_MONTH } from "@/lib/subscriptionBilling";

export type PlaidDetectedSubscription = {
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly" | "custom";
  category: string;
  lastCharged: string;
  confidence: "high" | "medium";
};

const KNOWN = [
  "netflix",
  "spotify",
  "apple",
  "google",
  "amazon prime",
  "hulu",
  "disney",
  "youtube",
  "microsoft",
  "adobe",
  "dropbox",
  "github",
  "openai",
  "anthropic",
  "notion",
  "linkedin",
  "duolingo",
  "nyt",
  "new york times",
  "chatgpt",
  "icloud",
  "peacock",
  "paramount",
  "espn",
  "hbo",
  "xbox",
  "playstation",
  "nintendo",
  "calm",
  "headspace",
  "peloton",
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

function categoryForMerchant(name: string): string {
  const k = normalizeKey(name);
  if (/netflix|hulu|disney|hbo|paramount|peacock|espn|apple tv|youtube|crunchyroll|fubo/.test(k)) return "Streaming";
  if (/spotify|apple music|tidal|amazon music|youtube music|pandora|soundcloud/.test(k)) return "Music";
  if (/openai|chatgpt|anthropic|claude|midjourney|perplexity|github copilot/.test(k)) return "AI";
  if (/icloud|google one|onedrive|box/.test(k)) return "Storage";
  if (/xbox|playstation|nintendo|ea games|steam|roblox/.test(k)) return "Gaming";
  if (/duolingo|coursera|skillshare|masterclass|chegg|khan/.test(k)) return "Education";
  if (/nyt|new york times|washington post|wall street journal|the athletic/.test(k)) return "News";
  if (/peloton|calm|headspace|myfitnesspal|strava|noom|equinox/.test(k)) return "Health";
  if (/starbucks|mcdonald|kfc|subway|doordash|uber eats|grubhub/.test(k)) return "Food & Dining";
  if (/microsoft|adobe|notion|dropbox|google|slack|zoom|grammarly|canva|evernote|github|figma|linear/.test(k)) return "Productivity";
  return "Other";
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
    case "yearly":
      return amount / 12;
    case "weekly":
      return amount * WEEKS_PER_MONTH;
    case "custom":
    case "monthly":
    default:
      return amount;
  }
}

export function detectSubscriptionsFromPlaidTransactions(
  transactions: Transaction[]
): PlaidDetectedSubscription[] {
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
      const confidence: "high" | "medium" =
        known || sorted.length >= 3 ? "high" : "medium";

      out.push({
        name: merchant,
        price: monthlyPrice,
        billingCycle: cycle === "custom" ? "monthly" : cycle,
        category: categoryForMerchant(merchant),
        lastCharged,
        confidence,
      });
      continue;
    }

    if (known && sorted.length === 1) {
      const avg = Math.abs(Number(last.amount));
      out.push({
        name: merchant,
        price: Number(avg.toFixed(2)),
        billingCycle: "monthly",
        category: categoryForMerchant(merchant),
        lastCharged,
        confidence: "medium",
      });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
