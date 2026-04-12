/**
 * Manual Plaid “sync” from the app: pulls transactions, runs detection, returns **candidates**
 * for the scan modal (`return_only`). Does not auto-add subscriptions here—that path is cron
 * `silent_auto` or user confirms in the modal → import API.
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
      mode: "return_only",
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
