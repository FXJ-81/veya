import type { Transaction } from "plaid";
import { getPlaidClient } from "@/lib/plaidServer";

/**
 * Date-range pull for scans. `/transactions/sync` `added` alone is often empty after the first
 * sync; `get` returns a stable window of history for the same detector Plaid shipped with.
 */
export const PLAID_SCAN_HISTORY_DAYS = 180;
const PAGE_SIZE = 500;

function formatPlaidCalendarDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchAllPlaidTransactions(
  plaid: ReturnType<typeof getPlaidClient>,
  accessToken: string,
): Promise<Transaction[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - PLAID_SCAN_HISTORY_DAYS);
  const endStr = formatPlaidCalendarDate(end);
  const startStr = formatPlaidCalendarDate(start);

  const out: Transaction[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const res = await plaid.transactionsGet({
      access_token: accessToken,
      start_date: startStr,
      end_date: endStr,
      options: {
        count: PAGE_SIZE,
        offset,
        include_personal_finance_category: true,
      },
    });
    const data = res.data;
    const batch = data.transactions ?? [];
    out.push(...batch);
    total =
      typeof data.total_transactions === "number"
        ? data.total_transactions
        : offset + batch.length;
    offset += batch.length;
    if (batch.length === 0) break;
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  return out.filter((t) => new Date(t.date) >= cutoff);
}
