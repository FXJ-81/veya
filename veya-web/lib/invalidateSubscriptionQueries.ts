import type { QueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";

/**
 * Call after any subscription mutation (create, update, delete, pause, resume).
 * Refetches active observers; stale data updates when user opens other routes.
 */
export async function invalidateAfterSubscriptionChange(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: QUERY_KEYS.subscriptions }),
    qc.invalidateQueries({ queryKey: QUERY_KEYS.pendingPlaidSubscriptions }),
    // Entire analytics tree (bundle lives under ["analytics", ...])
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics.all }),
    // Explicit segments (for future split queries; no-ops today if unused)
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics.summary }),
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics.history }),
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics.categories }),
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics.score }),
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics.insights }),
    // Budget progress uses live subscription spend
    qc.invalidateQueries({ queryKey: QUERY_KEYS.budgets.status }),
    // Dashboard AI tip uses subscription data
    qc.invalidateQueries({ queryKey: QUERY_KEYS.dailyTip }),
  ]);
}

/** After creating/updating/deleting a budget limit (not subscription list). */
export async function invalidateAfterBudgetChange(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: QUERY_KEYS.budgets.status }),
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics.all }),
  ]);
}
