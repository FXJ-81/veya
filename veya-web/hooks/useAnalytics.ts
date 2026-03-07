"use client";

import { useQuery } from "@tanstack/react-query";
import type { MonthlySpend, SpendingBreakdown } from "@/types";

interface AnalyticsData {
  score: number;
  monthlySpend: MonthlySpend[];
  categoryBreakdown: SpendingBreakdown[];
  yearlyProjection: number;
  insights: string[];
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch("/api/analytics");
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
  });
}
