/**
 * Client-side helper: runs Gmail import API and/or creates Plaid-backed subscriptions via REST,
 * using the same dedupe keys as the server. Clears declined-merchant keys after successful Plaid adds.
 */
import { buildSubscriptionCreateFromPlaid } from "@/lib/plaidImportHelpers";
import {
  keysForPlaidMerchant,
  isPlaidMerchantDuplicateOfExisting,
} from "@/lib/plaidSyncCore";
import { subscriptionNameKeySet } from "@/lib/subscriptionDedup";
import type { ScanImportPayload } from "@/types/scan";

export type ScanImportResult = {
  /** Plaid-created rows successfully POSTed */
  plaidAdded: number;
  /** Skipped: already in list (name/merchant) or duplicate in this batch */
  plaidSkipped: number;
};

async function removePlaidKeysFromDeclinedList(removeKeys: string[]): Promise<void> {
  if (removeKeys.length === 0) return;
  await fetch("/api/settings/plaid-declined", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removeKeys }),
  });
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
    const importedKeys: string[] = [];

    for (const item of payload.plaidItems) {
      if (isPlaidMerchantDuplicateOfExisting(item, existingKeys, batchSeen)) {
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
      for (const k of keysForPlaidMerchant(item)) {
        batchSeen.add(k);
        existingKeys.add(k);
        importedKeys.push(k);
      }
    }

    await removePlaidKeysFromDeclinedList(importedKeys);
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
