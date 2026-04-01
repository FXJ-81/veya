import { NextResponse } from "next/server";
import type { Transaction } from "plaid";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaidServer";
import { detectSubscriptionsFromPlaidTransactions } from "@/lib/plaidSubscriptionDetect";

export async function POST(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { plaidAccessToken: true, plaidLinked: true },
  });
  if (!user?.plaidAccessToken || !user.plaidLinked) {
    return NextResponse.json({ error: "Bank not connected" }, { status: 400 });
  }

  try {
    const plaid = getPlaidClient();
    const transactions: Transaction[] = [];
    let cursor: string | undefined;

    for (;;) {
      const res = await plaid.transactionsSync({
        access_token: user.plaidAccessToken,
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
    const filtered = transactions.filter((t) => new Date(t.date) >= cutoff);

    const subscriptions = detectSubscriptionsFromPlaidTransactions(filtered);

    await prisma.user.update({
      where: { id: authUser.id },
      data: { lastPlaidSync: new Date() },
    });

    console.log(
      "[POST /api/plaid/detect-subscriptions] user",
      authUser.id,
      "tx",
      filtered.length,
      "detected",
      subscriptions.length
    );

    return NextResponse.json({ ok: true, subscriptions });
  } catch (e) {
    console.error("[POST /api/plaid/detect-subscriptions]", e);
    return NextResponse.json({ error: "Failed to analyze transactions" }, { status: 500 });
  }
}
