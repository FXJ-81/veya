export type PendingPlaidSubscriptionCandidate = {
  id: string;
  name: string;
  merchantName: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly" | "custom";
  lastCharged: string;
  confidence: "high" | "medium";
  status: "pending" | "declined" | "added";
  firstDetectedAt: string;
  lastDetectedAt: string;
};
