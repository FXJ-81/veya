"use client";

import { motion } from "framer-motion";
import { scoreAccentColor, scoreLabel } from "@/lib/subscriptionBilling";
import { formatCurrency } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  hasActiveSubscriptions: boolean;
  /** Active subs: normalized monthly total (from analytics API). */
  monthlySubscriptionSpend?: number;
  nationalAvgMonthly?: number;
}

export function ScoreGauge({
  score,
  hasActiveSubscriptions,
  monthlySubscriptionSpend,
  nationalAvgMonthly = 219,
}: ScoreGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const label = scoreLabel(clamped, hasActiveSubscriptions);
  const color = scoreAccentColor(clamped, hasActiveSubscriptions);

  const helper = !hasActiveSubscriptions
    ? "Add subscriptions to get your score"
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex w-full min-w-0 flex-col items-center rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Subscription score
      </h3>
      <div className="relative mx-auto h-24 w-full max-w-[200px] md:mx-0 md:max-w-[12rem]">
        <svg
          viewBox="0 0 120 60"
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          <path
            d="M 10 50 A 50 50 0 0 1 110 50"
            fill="none"
            stroke="#2a2a3a"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <motion.path
            d="M 10 50 A 50 50 0 0 1 110 50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: hasActiveSubscriptions ? clamped / 100 : 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="font-mono text-3xl font-bold text-text-primary font-mono-nums"
          >
            {clamped}
          </motion.span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2" style={{ color }}>
        {label}
      </p>
      {hasActiveSubscriptions && monthlySubscriptionSpend != null ? (
        <p className="mt-1 max-w-xs text-center text-xs text-text-secondary">
          You spend {formatCurrency(monthlySubscriptionSpend)}/mo · National avg:{" "}
          {formatCurrency(nationalAvgMonthly)}/mo
        </p>
      ) : helper ? (
        <p className="mt-1 max-w-xs text-center text-xs text-text-secondary">{helper}</p>
      ) : null}
    </motion.div>
  );
}
