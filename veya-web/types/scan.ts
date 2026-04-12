export type SubscriptionScanSource = "gmail" | "plaid" | "confirmed";

export type GmailScanRow = {
  rowId?: string;
  messageId?: string;
  source?: SubscriptionScanSource;
  /** When false, checkbox starts unchecked (e.g. previously declined Plaid merchant). */
  defaultSelected?: boolean;
  name: string;
  /** Plaid: raw merchant / transaction label for dedup vs existing subs */
  merchantName?: string;
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
  /** Bank merchant name (normalized dedup vs subscription names) */
  merchantName?: string;
  category: string;
  price: number;
  billingCycle: "monthly" | "yearly" | "weekly" | "custom";
  lastCharged: string;
};

export type ScanImportPayload = {
  gmailMessageIds: string[];
  plaidItems: PlaidImportItem[];
};
