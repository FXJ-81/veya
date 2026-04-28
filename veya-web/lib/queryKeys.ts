/**
 * TanStack Query keys — use consistent prefixes so invalidation stays predictable.
 */
export const QUERY_KEYS = {
  subscriptions: ["subscriptions"] as const,

  analytics: {
    /** Matches any query whose key starts with "analytics" */
    all: ["analytics"] as const,
    /**
     * Full payload from GET /api/analytics (score, monthly history, categories, insights, projection).
     * Conceptually covers: summary, history, categories, score, insights.
     */
    bundle: ["analytics", "bundle"] as const,
    /** Reserved for future split endpoints / selectors */
    summary: ["analytics", "summary"] as const,
    history: ["analytics", "history"] as const,
    categories: ["analytics", "categories"] as const,
    score: ["analytics", "score"] as const,
    insights: ["analytics", "insights"] as const,
  },

  dailyTip: ["daily-tip"] as const,

  budgets: {
    status: ["budgets", "status"] as const,
  },
} as const;
