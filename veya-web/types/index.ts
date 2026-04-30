export type BillingCycle = "monthly" | "yearly" | "weekly" | "custom";
export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface DiscoverSuggestion {
  name: string;
  category: string;
  price: number;
  billingCycle: BillingCycle;
  nextRenewal: string;
  startDate: string;
  logoUrl?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  category: string;
  price: number;
  /** Optional scheduled new price (keeps `price` until effective date). */
  upcomingPrice?: number | null;
  /** ISO date for when `upcomingPrice` takes effect. */
  upcomingPriceEffectiveAt?: string | null;
  billingCycle: BillingCycle;
  startDate: string;
  nextRenewal: string;
  status: SubscriptionStatus;
  logoUrl?: string | null;
  notes?: string | null;
  /** manual (default) or gmail */
  source?: string;
  isShared: boolean;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionWithAlternative extends Subscription {
  alternative?: { name: string; price: number; savings: number };
}

export interface SpendingBreakdown {
  category: string;
  total: number;
  count: number;
  /** 0–100, share of total monthly normalized spend */
  percentage?: number;
}

export interface MonthlySpendContributor {
  name: string;
  amount: number;
}

export interface MonthlySpend {
  month: number;
  year: number;
  total: number;
  /** Short month label, e.g. "Jan" */
  label: string;
  /** Position relative to today within `year` */
  period: "past" | "current" | "future";
  /** Subscriptions that contributed to this month’s total (amount > 0) */
  contributors: MonthlySpendContributor[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  sentAt: string;
}

export interface UserSettings {
  notificationPrefs?: Record<string, boolean>;
  budgetLimit?: number | null;
  /** "brand" | "white" — persisted accent for signed-in UI */
  accentPreference?: string;
}

export interface AIMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  kind?: "chat" | "action";
  meta?: Record<string, unknown>;
}
