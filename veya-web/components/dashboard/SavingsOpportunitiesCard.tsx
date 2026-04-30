"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { BudgetStatus } from "@/app/api/budgets/status/route";
import type { Subscription } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { hasSubscriptionStarted, pricePerMonthAt } from "@/lib/subscriptionBilling";
import { useBudgetStatuses } from "@/hooks/useBudgetStatus";

type Suggestion = {
  id: string;
  monthlyImpact: number;
  lines: ReactNode[];
};

function suggestionShell(lines: ReactNode[]) {
  return (
    <div className="space-y-1 text-sm leading-snug text-text-secondary">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

export function SavingsOpportunitiesCard({
  subs,
  subsLoading,
}: {
  subs: Subscription[] | undefined;
  subsLoading: boolean;
}) {
  const { data: budgetStatuses = [] } = useBudgetStatuses();

  const suggestions = useMemo((): Suggestion[] => {
    if (!subs?.length) return [];

    const list = subs;
    const activeStarted = list.filter(
      (s) => s.status === "active" && hasSubscriptionStarted(new Date(s.startDate)),
    );
    const paused = list.filter((s) => s.status === "paused");

    const out: Suggestion[] = [];

    if (activeStarted.length > 0) {
      const top = [...activeStarted].sort(
        (a, b) =>
          pricePerMonthAt(b, new Date()) - pricePerMonthAt(a, new Date()),
      )[0]!;
      const mo = pricePerMonthAt(top, new Date());
      out.push({
        id: "expensive",
        monthlyImpact: mo,
        lines: [
          <>
            Cancel <span className="font-bold text-text-primary">{top.name}</span> and save{" "}
            <span className="font-mono font-semibold text-success font-mono-nums">
              {formatCurrency(mo)}/mo
            </span>
          </>,
        ],
      });
    }

    if (paused.length > 0) {
      const mo = paused.reduce((sum, s) => sum + pricePerMonthAt(s, new Date()), 0);
      const yr = mo * 12;
      out.push({
        id: "paused",
        monthlyImpact: mo,
        lines: [
          <>
            You have <span className="font-bold text-text-primary">{paused.length}</span> paused{" "}
            {paused.length === 1 ? "sub" : "subs"} costing{" "}
            <span className="font-mono font-semibold text-success font-mono-nums">
              {formatCurrency(mo)}/mo
            </span>
          </>,
          <>
            Consider cancelling them to save{" "}
            <span className="font-mono font-semibold text-success font-mono-nums">
              {formatCurrency(yr)}/yr
            </span>
          </>,
        ],
      });
    }

    const byCategory = new Map<string, Subscription[]>();
    for (const s of activeStarted) {
      const arr = byCategory.get(s.category) ?? [];
      arr.push(s);
      byCategory.set(s.category, arr);
    }
    let bestCat: string | null = null;
    let bestList: Subscription[] | null = null;
    for (const [cat, arr] of byCategory) {
      if (arr.length < 3) continue;
      if (
        !bestList ||
        arr.length > bestList.length ||
        (arr.length === bestList.length &&
          arr.reduce((s, x) => s + pricePerMonthAt(x, new Date()), 0) >
            bestList.reduce((s, x) => s + pricePerMonthAt(x, new Date()), 0))
      ) {
        bestCat = cat;
        bestList = arr;
      }
    }
    if (bestCat && bestList && bestList.length >= 3) {
      const perSub = bestList.map((s) => pricePerMonthAt(s, new Date()));
      const total = perSub.reduce((a, b) => a + b, 0);
      const minSingle = Math.min(...perSub);
      const saveMo = Math.max(0, total - minSingle);
      const label =
        bestCat === "Streaming"
          ? `${bestList.length} streaming services`
          : `${bestList.length} ${bestCat} subscriptions`;
      out.push({
        id: `dup-${bestCat}`,
        monthlyImpact: saveMo,
        lines: [
          <>
            You have <span className="font-bold text-text-primary">{label}</span> (
            <span className="font-mono font-mono-nums text-text-primary">
              {formatCurrency(total)}/mo
            </span>{" "}
            total)
          </>,
          <>Consider keeping just one</>,
        ],
      });
    }

    const exceeded = budgetStatuses.filter((b) => b.percentage >= 100);
    if (exceeded.length > 0) {
      const b = exceeded.sort((a, c) => (c.spent - c.limit) - (a.spent - a.limit))[0]!;
      const overMo = Math.max(0, b.spent - b.limit);
      out.push({
        id: `budget-${b.id}`,
        monthlyImpact: overMo,
        lines: [
          <>
            Your {b.category === "__total__" ? (
              <span className="font-bold text-text-primary">total subscription</span>
            ) : (
              <span className="font-bold text-text-primary">{b.category}</span>
            )}{" "}
            spend exceeds your{" "}
            <span className="font-mono font-semibold text-text-primary font-mono-nums">
              {formatCurrency(b.limit)}
            </span>{" "}
            limit
          </>,
          <>Cancel one to get back on track</>,
        ],
      });
    }

    return out.slice(0, 4);
  }, [subs, budgetStatuses]);

  const totalMo = suggestions.reduce((s, x) => s + x.monthlyImpact, 0);
  const totalYr = totalMo * 12;

  if (subsLoading && !subs) {
    return (
      <div className="h-full min-h-[16rem] w-full animate-pulse rounded-2xl border border-border bg-card/60" />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 sm:p-6"
    >
      <h3 className="text-lg font-semibold text-text-primary">💡 Savings Opportunities</h3>
      <p className="mt-1 text-sm text-text-secondary">Subscriptions you could review</p>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        {suggestions.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center rounded-xl border border-success/25 bg-success/5 px-4 py-6 text-center">
            <p className="text-lg" aria-hidden>
              ✅
            </p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              Your subscriptions look optimized!
            </p>
            <p className="mt-1 text-sm text-text-secondary">No obvious waste detected</p>
          </div>
        ) : (
          suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border/80 border-l-[3px] border-l-orange-500/85 bg-background-secondary/30 pl-3.5 pr-3 py-2.5"
            >
              {suggestionShell(s.lines)}
              <Link
                href="/subscriptions"
                className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
              >
                Review →
              </Link>
            </div>
          ))
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-semibold text-success">
            Total potential savings:{" "}
            <span className="font-mono font-mono-nums">{formatCurrency(totalMo)}/mo</span>
          </p>
          <p className="mt-1 text-sm font-medium text-success/90">
            <span className="font-mono font-mono-nums">{formatCurrency(totalYr)}/yr</span> if all
            cancelled
          </p>
        </div>
      )}
    </motion.div>
  );
}
