"use client";

import { useQuery } from "@tanstack/react-query";
import type { BudgetStatus } from "@/app/api/budgets/status/route";
import { QUERY_KEYS } from "@/lib/queryKeys";

async function fetchBudgetStatuses(): Promise<BudgetStatus[]> {
  const res = await fetch("/api/budgets/status");
  if (!res.ok) throw new Error("Failed to load budget status");
  const j = (await res.json()) as { statuses?: BudgetStatus[] };
  return j.statuses ?? [];
}

export function useBudgetStatuses() {
  return useQuery({
    queryKey: QUERY_KEYS.budgets.status,
    queryFn: fetchBudgetStatuses,
    staleTime: 0,
  });
}
