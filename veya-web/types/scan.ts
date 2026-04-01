export type SubscriptionScanSource = "gmail" | "plaid" | "confirmed";

export type GmailScanRow = {
  rowId?: string;
  messageId?: string;
  source?: SubscriptionScanSource;
  name: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly" | "custom";
  monthlyEquivalent: number;
  logoUrl: string;
  emailDate?: string;
  senderDomain?: string;
  lastCharged?: string;
  confidence?: "high" | "medium";
};

export type PlaidImportItem = {
  name: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly" | "custom";
  lastCharged: string;
};

export type ScanImportPayload = {
  gmailMessageIds: string[];
  plaidItems: PlaidImportItem[];
};
