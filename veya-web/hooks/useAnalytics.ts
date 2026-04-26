"use client";

import { useQuery } from "@tanstack/react-query";
import type { MonthlySpend, SpendingBreakdown } from "@/types";
import { QUERY_KEYS } from "@/lib/queryKeys";

export type AnalyticsInsightCard = {
  icon: string;
  title: string;
  description: string;
};

interface AnalyticsData {
  plan: "free" | "premium";
  advancedAnalyticsLocked: boolean;
  score: number | null;
  hasActiveSubscriptions: boolean;
  monthlySpend: MonthlySpend[];
  categoryBreakdown: SpendingBreakdown[];
  yearlyProjection: number | null;
  monthlySubscriptionSpend: number;
  nationalAvgMonthly: number;
  insightCards: AnalyticsInsightCard[];
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch("/api/analytics");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.code === "string" ? body.code : "Failed to fetch analytics");
  }
  return res.json();
}

export function useAnalytics() {
  return useQuery({
    queryKey: QUERY_KEYS.analytics.bundle,
    queryFn: fetchAnalytics,
    staleTime: 0,
  });
}
