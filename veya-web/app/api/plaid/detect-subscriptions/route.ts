/**
 * Manual Plaid sync from the app: pulls transactions, runs detection, and stores new candidates
 * as pending review items. Returns the pending review rows found during this run for the modal.
 */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { runPlaidSubscriptionSyncForUser } from "@/lib/runPlaidSubscriptionSync";

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let plaidAccountId: string | undefined;
  try {
    const j = await req.json().catch(() => ({}));
    if (j && typeof j.plaidAccountId === "string" && j.plaidAccountId.trim()) {
      plaidAccountId = j.plaidAccountId.trim();
    }
  } catch {
    /* optional body */
  }

  try {
    const result = await runPlaidSubscriptionSyncForUser(authUser.id, {
      plaidAccountId,
      mode: "store_pending",
    });

    if (!result.ok) {
      const status = result.error === "Bank not connected" ? 400 : 503;
      return NextResponse.json({ error: result.error ?? "Sync failed" }, { status });
    }

    console.log(
      "[POST /api/plaid/detect-subscriptions] user",
      authUser.id,
      "banks ok",
      result.bankItemsProcessed,
      "banks err",
      result.bankItemsFailed,
      "tx",
      result.transactionsCount,
      "candidates",
      result.candidates?.length ?? 0,
      "pending created",
      result.pendingCreated,
    );

    return NextResponse.json({
      ok: true,
      subscriptions: result.candidates ?? [],
      sync: {
        bankItemsProcessed: result.bankItemsProcessed,
        bankItemsFailed: result.bankItemsFailed,
        skippedExisting: result.skippedExisting,
      },
    });
  } catch (e) {
    console.error("[POST /api/plaid/detect-subscriptions]", e);
    return NextResponse.json({ error: "Failed to analyze transactions" }, { status: 500 });
  }
}
