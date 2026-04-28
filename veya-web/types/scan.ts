export type SubscriptionScanSource = "gmail" | "plaid" | "confirmed";

export type GmailScanRow = {
  rowId?: string;
  messageId?: string;
  source?: SubscriptionScanSource;
  /** When false, checkbox starts unchecked (e.g. previously declined Plaid merchant). */
  defaultSelected?: boolean;
  /** Bank rescan matched a subscription the user canceled earlier. */
  previouslyCanceled?: boolean;
  /** When set, applying this row reactivates this subscription instead of creating a new one. */
  resumeSubscriptionId?: string;
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
  /** Reactivate this row instead of POSTing a new subscription (previously canceled match). */
  resumeSubscriptionId?: string;
};

export type ScanImportPayload = {
  gmailMessageIds: string[];
  plaidItems: PlaidImportItem[];
};
