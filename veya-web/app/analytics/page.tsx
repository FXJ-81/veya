"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { ScoreGauge } from "@/components/analytics/ScoreGauge";
import { SpendChart } from "@/components/analytics/SpendChart";
import { CategoryDonut } from "@/components/analytics/CategoryDonut";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Skeleton } from "@/components/ui/Skeleton";
import { BudgetLimitsSection } from "@/components/analytics/BudgetLimitsSection";

export default function AnalyticsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { data: analytics, isLoading, isFetching, isError, error, refetch } = useAnalytics();
  const premiumLocked = error instanceof Error && error.message === "PREMIUM_REQUIRED";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  return (
    <AppShell>
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
        ) : premiumLocked ? (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-text-primary">Analytics are Premium</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Upgrade to Premium for advanced analytics, spending insights, yearly projections, and category breakdowns.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-medium text-text-primary">Could not load analytics</p>
            <p className="mt-2 text-sm text-text-secondary">
              Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-6 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            className={`space-y-8 transition-opacity duration-200 ${
              isFetching && analytics != null ? "opacity-[0.88]" : "opacity-100"
            }`}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ScoreGauge
                score={analytics?.score ?? 0}
                hasActiveSubscriptions={
                  analytics?.hasActiveSubscriptions ??
                  (analytics?.categoryBreakdown?.length ?? 0) > 0
                }
                monthlySubscriptionSpend={analytics?.monthlySubscriptionSpend}
                nationalAvgMonthly={analytics?.nationalAvgMonthly}
              />
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
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

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <CategoryDonut data={analytics?.categoryBreakdown ?? []} />
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">
                  AI insights
                </h3>
                <div className="grid max-h-[min(70vh,720px)] gap-3 overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible">
                  {(analytics?.insightCards ?? []).map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.05, 0.2) }}
                      className="rounded-xl border border-border/80 bg-background-secondary/40 p-3 sm:p-4"
                    >
                      <div className="flex gap-3">
                        <span className="shrink-0 text-xl leading-none" aria-hidden>
                          {card.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-primary">{card.title}</p>
                          <p className="mt-1 text-sm leading-snug text-text-secondary line-clamp-2">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <BudgetLimitsSection />
          </div>
        )}
    </AppShell>
  );
}
