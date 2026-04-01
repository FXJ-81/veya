import { buildSubscriptionCreateFromPlaid } from "@/lib/plaidImportHelpers";
import type { ScanImportPayload } from "@/types/scan";

export async function executeScanImport(
  payload: ScanImportPayload,
  options?: { firstAutoComplete?: boolean }
): Promise<void> {
  let firstFlowMarkedViaGmail = false;

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

  for (const item of payload.plaidItems) {
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
  }

  if (options?.firstAutoComplete && !firstFlowMarkedViaGmail) {
    await fetch("/api/subscriptions/gmail-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss-first-auto" }),
    });
  }
}
