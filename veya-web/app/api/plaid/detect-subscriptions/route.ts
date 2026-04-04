import { NextResponse } from "next/server";
import type { Transaction } from "plaid";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";
import { detectSubscriptionsFromPlaidTransactions } from "@/lib/plaidSubscriptionDetect";

async function fetchAllTransactions(
  plaid: ReturnType<typeof getPlaidClient>,
  accessToken: string,
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];
  let cursor: string | undefined;
  for (;;) {
    const res = await plaid.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
      options: {
        include_personal_finance_category: true,
      },
    });
    const data = res.data;
    transactions.push(...data.added);
    cursor = data.next_cursor;
    if (!data.has_more) break;
  }
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  return transactions.filter((t) => new Date(t.date) >= cutoff);
}

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

  let accounts = await prisma.plaidAccount.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "asc" },
  });

  if (plaidAccountId) {
    accounts = accounts.filter((a) => a.id === plaidAccountId);
  }

  if (accounts.length === 0) {
    return NextResponse.json({ error: "Bank not connected" }, { status: 400 });
  }

  try {
    const plaid = getPlaidClient();
    const allTx: Transaction[] = [];
    for (const acc of accounts) {
      const batch = await fetchAllTransactions(plaid, acc.accessToken);
      allTx.push(...batch);
    }

    const subscriptions = await detectSubscriptionsFromPlaidTransactions(allTx);
    const now = new Date();
    await prisma.plaidAccount.updateMany({
      where: { id: { in: accounts.map((a) => a.id) } },
      data: { lastSync: now },
    });

    console.log(
      "[POST /api/plaid/detect-subscriptions] user",
      authUser.id,
      "banks",
      accounts.length,
      "tx",
      allTx.length,
      "detected",
      subscriptions.length,
    );

    return NextResponse.json({ ok: true, subscriptions });
  } catch (e) {
    console.error("[POST /api/plaid/detect-subscriptions]", e);
    return NextResponse.json({ error: "Failed to analyze transactions" }, { status: 500 });
  }
}
