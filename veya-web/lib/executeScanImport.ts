import { buildSubscriptionCreateFromPlaid } from "@/lib/plaidImportHelpers";
import {
  normalizeSubscriptionNameKey,
  subscriptionNameKeySet,
} from "@/lib/subscriptionDedup";
import type { ScanImportPayload } from "@/types/scan";

export type ScanImportResult = {
  /** Plaid-created rows successfully POSTed */
  plaidAdded: number;
  /** Skipped: already in list (name/merchant) or duplicate in this batch */
  plaidSkipped: number;
};

function keysForPlaidItem(item: {
  name: string;
  merchantName?: string;
}): string[] {
  const keys = new Set<string>();
  const n = normalizeSubscriptionNameKey(item.name);
  if (n) keys.add(n);
  const m = item.merchantName ? normalizeSubscriptionNameKey(item.merchantName) : "";
  if (m && m !== n) keys.add(m);
  return [...keys];
}

function isPlaidDuplicate(
  item: { name: string; merchantName?: string },
  existing: Set<string>,
  batchSeen: Set<string>,
): boolean {
  const keys = keysForPlaidItem(item);
  for (const k of keys) {
    if (existing.has(k) || batchSeen.has(k)) return true;
  }
  return false;
}

export async function executeScanImport(
  payload: ScanImportPayload,
  options?: { firstAutoComplete?: boolean },
): Promise<ScanImportResult> {
  let firstFlowMarkedViaGmail = false;
  let plaidAdded = 0;
  let plaidSkipped = 0;

  if (payload.gmailMessageIds.length > 0) {
    const res = await fetch("/api/subscriptions/gmail-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import",
        messageIds: payload.gmailMessageIds,
        firstAutoComplete: options?.firstAutoComplete,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error ?? "Gmail import failed");
    }
    if (options?.firstAutoComplete) firstFlowMarkedViaGmail = true;
  }

  if (payload.plaidItems.length > 0) {
    const subsRes = await fetch("/api/subscriptions");
    const existingList = subsRes.ok ? ((await subsRes.json()) as { name: string }[]) : [];
    const existingKeys = subscriptionNameKeySet(existingList);
    const batchSeen = new Set<string>();

    for (const item of payload.plaidItems) {
      if (isPlaidDuplicate(item, existingKeys, batchSeen)) {
        plaidSkipped++;
        continue;
      }

      const body = buildSubscriptionCreateFromPlaid(item);
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `Failed to add ${item.name}`);
      }

      plaidAdded++;
      for (const k of keysForPlaidItem(item)) {
        batchSeen.add(k);
        existingKeys.add(k);
      }
    }
  }

  if (options?.firstAutoComplete && !firstFlowMarkedViaGmail) {
    await fetch("/api/subscriptions/gmail-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss-first-auto" }),
    });
  }

  return { plaidAdded, plaidSkipped };
}
