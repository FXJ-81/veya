/** Paginates Plaid `transactionsSync` until `has_more` is false, then filters to last 24 months. */
import type { Transaction } from "plaid";
import { getPlaidClient } from "@/lib/plaidServer";

export async function fetchAllPlaidTransactions(
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
