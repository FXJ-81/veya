"use client";

import { motion } from "framer-motion";

interface ScoreGaugeProps {
  score: number;
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const color =
    clamped >= 71 ? "#34d399" : clamped >= 41 ? "#fbbf24" : "#f87171";

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
            animate={{ pathLength: clamped / 100 }}
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
      <p className="text-sm text-text-secondary mt-2">
        {clamped >= 71 ? "Great" : clamped >= 41 ? "Fair" : "Review"} — lower spend = higher score
      </p>
    </motion.div>
  );
}
