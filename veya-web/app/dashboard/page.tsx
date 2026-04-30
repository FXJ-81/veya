"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { RenewalCard } from "@/components/dashboard/RenewalCard";
import { AITipCard } from "@/components/dashboard/AITipCard";
import { CategoryDonut } from "@/components/analytics/CategoryDonut";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getGreeting, formatCurrency } from "@/lib/utils";
import { hasSubscriptionStarted, pricePerMonthAt } from "@/lib/subscriptionBilling";
import { nextRenewalSortKey } from "@/lib/subscriptionRenewal";
import { Skeleton } from "@/components/ui/Skeleton";
import { BudgetAlerts } from "@/components/dashboard/BudgetAlerts";
import { SavingsOpportunitiesCard } from "@/components/dashboard/SavingsOpportunitiesCard";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const {
    data: subscriptionData,
    isLoading: subsLoading,
    isFetching: subsFetching,
    isError: subsError,
    refetch: refetchSubs,
  } = useSubscriptions();
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isFetching: analyticsFetching,
    isError: analyticsError,
    error: analyticsErrorValue,
    refetch: refetchAnalytics,
  } = useAnalytics();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (subsError) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="font-medium text-text-primary">Could not load dashboard data</p>
          <p className="mt-2 text-sm text-text-secondary">
            Subscriptions could not be loaded. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void refetchSubs()}
            className="mt-6 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </AppShell>
    );
  }

  const subs = subscriptionData?.subscriptions ?? [];
  const isFreePlan = subscriptionData?.plan !== "premium";
  const analyticsPremiumLocked =
    analyticsErrorValue instanceof Error && analyticsErrorValue.message === "PREMIUM_REQUIRED";
  const activeSubs = subs.filter((s) => s.status === "active");
  const monthlyTotal = activeSubs
    .filter((s) => hasSubscriptionStarted(new Date(s.startDate)))
    .reduce((sum, s) => sum + pricePerMonthAt(s, new Date()), 0);
  const renewals = activeSubs
    .sort((a, b) => nextRenewalSortKey(a) - nextRenewalSortKey(b))
    .slice(0, 6);

  const stats = [
    {
      label: isFreePlan ? "Analytics" : "Yearly projection",
      value: isFreePlan ? "Premium" : formatCurrency((analytics?.yearlyProjection ?? monthlyTotal * 12)),
    },
    {
      label: "Active subs",
      value: activeSubs.length,
      sub: "subscriptions",
    },
    {
      label: "Paused",
      value: subs.filter((s) => s.status === "paused").length,
    },
    {
      label: "Avg cost",
      value:
        activeSubs.length > 0
          ? formatCurrency(monthlyTotal / activeSubs.length)
          : "$0",
      sub: "per sub/mo",
    },
  ];

  return (
    <AppShell>
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {getGreeting()}, {session?.user?.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <NotificationBell />
        </motion.header>

        <div
          className={`space-y-5 transition-opacity duration-200 ${
            (subsFetching && subscriptionData != null) || (analyticsFetching && analytics != null)
              ? "opacity-[0.88]"
              : "opacity-100"
          }`}
        >
          {(subsFetching && subscriptionData != null) || (analyticsFetching && analytics != null) ? (
            <p className="text-xs font-medium text-text-tertiary -mt-2 mb-1 animate-pulse">
              Updating figures…
            </p>
          ) : null}
          <BudgetAlerts />
          <HeroCard
            monthlyTotal={monthlyTotal}
            trend={!isFreePlan && analytics ? (monthlyTotal > 0 ? -5 : 0) : undefined}
            label="Monthly spend"
          />
          <StatsRow stats={stats} />

          <div>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Upcoming renewals
            </h2>
            <div className="flex min-w-0 gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory">
              {subsLoading ? (
                <Skeleton className="h-32 w-48 flex-shrink-0 rounded-xl" />
              ) : renewals.length === 0 ? (
                <p className="text-text-secondary text-sm">
                  No upcoming renewals. Add subscriptions to see them here.
                </p>
              ) : (
                renewals.map((sub, i) => (
                  <RenewalCard key={sub.id} subscription={sub} index={i} />
                ))
              )}
            </div>
          </div>

          <AITipCard />

          <div>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">Spending breakdown</h2>
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[55fr_45fr]">
              <div className="flex h-full min-h-[18rem] flex-col lg:min-h-[22rem]">
                {analyticsLoading ? (
                  <Skeleton className="min-h-[18rem] flex-1 rounded-2xl lg:min-h-full" />
                ) : analyticsPremiumLocked ? (
                  <div className="flex min-h-[18rem] flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center lg:min-h-full">
                    <p className="font-medium text-text-primary">Analytics are Premium</p>
                    <p className="mt-2 max-w-sm text-sm text-text-secondary">
                      Upgrade for spending breakdowns, projections, and advanced insights.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/settings")}
                      className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                ) : analyticsError ? (
                  <div className="flex min-h-[18rem] flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center lg:min-h-full">
                    <p className="text-sm text-text-secondary">Could not load spending breakdown.</p>
                    <button
                      type="button"
                      onClick={() => void refetchAnalytics()}
                      className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-background-secondary"
                    >
                      Retry
                    </button>
                  </div>
                ) : analytics?.categoryBreakdown?.length ? (
                  <CategoryDonut
                    data={analytics.categoryBreakdown}
                    variant="split"
                    className="min-h-0 flex-1"
                  />
                ) : (
                  <div className="flex min-h-[18rem] flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center text-sm text-text-secondary lg:min-h-full">
                    Add subscriptions to see breakdown.
                  </div>
                )}
              </div>
              <div className="flex h-full min-h-[18rem] flex-col lg:min-h-[22rem]">
                <SavingsOpportunitiesCard subs={subs} subsLoading={subsLoading} />
              </div>
            </div>
          </div>
        </div>
    </AppShell>
  );
}
