export type BillingCycle = "monthly" | "yearly" | "weekly";
export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface DiscoverSuggestion {
  name: string;
  category: string;
  price: number;
  billingCycle: BillingCycle;
  nextRenewal: string;
  startDate: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  category: string;
  price: number;
  billingCycle: BillingCycle;
  startDate: string;
  nextRenewal: string;
  status: SubscriptionStatus;
  logoUrl?: string | null;
  notes?: string | null;
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
}

export interface MonthlySpend {
  month: number;
  year: number;
  total: number;
  label: string;
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
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}
