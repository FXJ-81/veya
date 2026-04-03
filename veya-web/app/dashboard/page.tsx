"use client";

import { Suspense, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/layout/PageLayout";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { RenewalCard } from "@/components/dashboard/RenewalCard";
import { AITipCard } from "@/components/dashboard/AITipCard";
import { CategoryDonut } from "@/components/analytics/CategoryDonut";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getGreeting, formatCurrency } from "@/lib/utils";
import { hasSubscriptionStarted, pricePerMonth } from "@/lib/subscriptionBilling";
import { nextRenewalSortKey } from "@/lib/subscriptionRenewal";
import { Skeleton } from "@/components/ui/Skeleton";
import { GmailOnboarding } from "@/components/dashboard/GmailOnboarding";
import { BudgetAlerts } from "@/components/dashboard/BudgetAlerts";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: subs, isLoading: subsLoading, isFetching: subsFetching } = useSubscriptions();
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isFetching: analyticsFetching,
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

  const activeSubs = subs?.filter((s) => s.status === "active") ?? [];
  const monthlyTotal = activeSubs
    .filter((s) => hasSubscriptionStarted(new Date(s.startDate)))
    .reduce((sum, s) => sum + pricePerMonth(s.price, s.billingCycle), 0);
  const renewals = activeSubs
    .sort((a, b) => nextRenewalSortKey(a) - nextRenewalSortKey(b))
    .slice(0, 6);

  const stats = [
    {
      label: "Yearly projection",
      value: formatCurrency((analytics?.yearlyProjection ?? monthlyTotal * 12)),
    },
    {
      label: "Active subs",
      value: activeSubs.length,
      sub: "subscriptions",
    },
    {
      label: "Paused",
      value: subs?.filter((s) => s.status === "paused").length ?? 0,
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
    <PageLayout>
        <Suspense fallback={null}>
          <GmailOnboarding />
        </Suspense>

        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {getGreeting()} {session?.user?.name?.split(" ")[0] ?? "there"} 👋
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <Link
            href="/settings"
            className="rounded-full h-10 w-10 border border-border bg-card flex items-center justify-center text-text-secondary hover:text-text-primary"
          >
            🔔
          </Link>
        </motion.header>

        <div
          className={`space-y-8 transition-opacity duration-200 ${
            (subsFetching && subs != null) || (analyticsFetching && analytics != null)
              ? "opacity-[0.88]"
              : "opacity-100"
          }`}
        >
          {(subsFetching && subs != null) || (analyticsFetching && analytics != null) ? (
            <p className="text-xs font-medium text-text-tertiary -mt-4 mb-2 animate-pulse">
              Updating figures…
            </p>
          ) : null}
          <BudgetAlerts />
          <HeroCard
            monthlyTotal={monthlyTotal}
            trend={analytics ? (monthlyTotal > 0 ? -5 : 0) : undefined}
            label="Monthly spend"
          />
          <StatsRow stats={stats} />

          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Upcoming renewals
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
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

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                Spending breakdown
              </h2>
              {analyticsLoading ? (
                <Skeleton className="h-64 rounded-2xl" />
              ) : analytics?.categoryBreakdown?.length ? (
                <CategoryDonut data={analytics.categoryBreakdown} />
              ) : (
                <div className="rounded-2xl border border-border bg-card p-8 text-center text-text-secondary text-sm">
                  Add subscriptions to see breakdown.
                </div>
              )}
            </div>
          </div>
        </div>
    </PageLayout>
  );
}
