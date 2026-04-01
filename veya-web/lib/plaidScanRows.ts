import type { PlaidDetectedSubscription } from "@/lib/plaidSubscriptionDetect";
import type { GmailScanRow } from "@/types/scan";

export function mapPlaidDetectToScanRows(subs: PlaidDetectedSubscription[]): GmailScanRow[] {
  return subs.map((s, i) => ({
    rowId: `plaid-${i}-${s.name.replace(/[^\w]+/g, "-").slice(0, 48)}`,
    source: "plaid" as const,
    name: s.name,
    category: s.category,
    price: s.price,
    billingCycle: s.billingCycle,
    monthlyEquivalent: s.price,
    logoUrl: `https://ui-avatars.com/api/?background=1a1a26&color=f8f8ff&size=128&name=${encodeURIComponent(s.name)}`,
    lastCharged: s.lastCharged,
    confidence: s.confidence,
  }));
}
