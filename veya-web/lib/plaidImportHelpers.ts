import { WEEKS_PER_MONTH } from "@/lib/subscriptionBilling";
import type { PlaidImportItem } from "@/types/scan";

/** `item.price` is monthly-equivalent from detection. Convert to per-period price for Subscription API. */
export function perPeriodPriceFromMonthly(monthly: number, billingCycle: PlaidImportItem["billingCycle"]): number {
  if (billingCycle === "yearly") return monthly * 12;
  if (billingCycle === "weekly") return monthly / WEEKS_PER_MONTH;
  return monthly;
}

export function buildSubscriptionCreateFromPlaid(item: PlaidImportItem): {
  name: string;
  category: string;
  price: number;
  billingCycle: PlaidImportItem["billingCycle"];
  startDate: string;
  nextRenewal: string;
  status: "active";
  isShared: boolean;
  source: "plaid";
} {
  const last = new Date(item.lastCharged);
  const start = new Date(last);
  const next = new Date(last);
  if (item.billingCycle === "monthly" || item.billingCycle === "custom") {
    start.setMonth(start.getMonth() - 1);
    next.setMonth(next.getMonth() + 1);
  } else if (item.billingCycle === "yearly") {
    start.setFullYear(start.getFullYear() - 1);
    next.setFullYear(next.getFullYear() + 1);
  } else {
    start.setDate(start.getDate() - 7);
    next.setDate(next.getDate() + 7);
  }

  return {
    name: item.name,
    category: item.category,
    price: Number(perPeriodPriceFromMonthly(item.price, item.billingCycle).toFixed(2)),
    billingCycle: item.billingCycle === "custom" ? "monthly" : item.billingCycle,
    startDate: start.toISOString().slice(0, 10),
    nextRenewal: next.toISOString().slice(0, 10),
    status: "active",
    isShared: false,
    source: "plaid",
  };
}
