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
    type SubRow = { name: string; status?: string; id?: string };
    let existingList: SubRow[] = [];
    if (subsRes.ok) {
      const raw: unknown = await subsRes.json();
      if (Array.isArray(raw)) {
        existingList = raw as SubRow[];
      } else if (raw && typeof raw === "object" && Array.isArray((raw as { subscriptions?: unknown }).subscriptions)) {
        existingList = (raw as { subscriptions: SubRow[] }).subscriptions;
      }
    }
    const activePaused = existingList.filter(
      (s) => (s.status ?? "active").toLowerCase() !== "cancelled",
    );
    const existingKeys = subscriptionNameKeySet(activePaused.map((s) => ({ name: s.name })));
    const batchSeen = new Set<string>();
    const importedKeys: string[] = [];

    for (const item of payload.plaidItems) {
      if (item.resumeSubscriptionId) {
        const body = buildSubscriptionCreateFromPlaid(item);
        const res = await fetch(`/api/subscriptions/${encodeURIComponent(item.resumeSubscriptionId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "active",
            name: body.name,
            category: body.category,
            price: body.price,
            billingCycle: body.billingCycle,
            startDate: body.startDate,
            nextRenewal: body.nextRenewal,
            source: body.source,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `Failed to restore ${item.name}`);
        }
        plaidAdded++;
        for (const k of keysForPlaidMerchant(item)) {
          batchSeen.add(k);
          existingKeys.add(k);
          importedKeys.push(k);
        }
        continue;
      }

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
