"use client";

import { motion } from "framer-motion";
import { scoreAccentColor, scoreLabel } from "@/lib/subscriptionBilling";

interface ScoreGaugeProps {
  score: number;
  /** False when user has no active subscriptions — score is 0 and we show “No Data”. */
  hasActiveSubscriptions: boolean;
}

export function ScoreGauge({ score, hasActiveSubscriptions }: ScoreGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const label = scoreLabel(clamped, hasActiveSubscriptions);
  const color = scoreAccentColor(clamped, hasActiveSubscriptions);

  const helper = !hasActiveSubscriptions
    ? "Add subscriptions to get your score"
    : "Higher score = better financial health based on your active subscriptions.";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Subscription score
      </h3>
      <div className="relative w-48 h-24">
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
            {hasActiveSubscriptions ? clamped : "—"}
          </motion.span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2" style={{ color }}>
        {label}
      </p>
      <p className="text-xs text-text-secondary mt-1 text-center max-w-xs">{helper}</p>
    </motion.div>
  );
}
