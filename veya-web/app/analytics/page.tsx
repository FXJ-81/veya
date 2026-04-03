"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScoreGauge } from "@/components/analytics/ScoreGauge";
import { SpendChart } from "@/components/analytics/SpendChart";
import { CategoryDonut } from "@/components/analytics/CategoryDonut";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Skeleton } from "@/components/ui/Skeleton";
import { BudgetLimitsSection } from "@/components/analytics/BudgetLimitsSection";

export default function AnalyticsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { data: analytics, isLoading, isFetching } = useAnalytics();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  return (
    <PageLayout>
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-2xl font-bold text-text-primary"
          >
            Analytics
          </motion.h1>
          {isFetching && analytics != null && (
            <span className="text-xs font-medium text-text-tertiary animate-pulse">
              Updating…
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <div
            className={`space-y-8 transition-opacity duration-200 ${
              isFetching && analytics != null ? "opacity-[0.88]" : "opacity-100"
            }`}
          >
            <div className="grid md:grid-cols-2 gap-6">
              <ScoreGauge
                score={analytics?.score ?? 0}
                hasActiveSubscriptions={
                  analytics?.hasActiveSubscriptions ??
                  (analytics?.categoryBreakdown?.length ?? 0) > 0
                }
              />
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  Yearly projection
                </h3>
                <p className="font-mono text-3xl font-bold text-accent font-mono-nums">
                  ${(analytics?.yearlyProjection ?? 0).toFixed(2)}
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  Based on current monthly spend
                </p>
              </div>
            </div>

            <SpendChart data={analytics?.monthlySpend ?? []} />

            <div className="grid lg:grid-cols-2 gap-6">
              <CategoryDonut data={analytics?.categoryBreakdown ?? []} />
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  AI insights
                </h3>
                <div className="space-y-3">
                  {(analytics?.insights ?? []).map((insight, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="text-sm text-text-secondary"
                    >
                      {insight}
                    </motion.p>
                  ))}
                  {(!analytics?.insights || analytics.insights.length === 0) && (
                    <p className="text-text-tertiary text-sm">
                      Add subscriptions and use the AI coach for personalized
                      insights.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <BudgetLimitsSection />
          </div>
        )}
    </PageLayout>
  );
}
