"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

interface HeroCardProps {
  monthlyTotal: number;
  trend?: number;
  label?: string;
}

export function HeroCard({ monthlyTotal, trend = 0, label }: HeroCardProps) {
  const isUp = trend > 0;
  const isDown = trend < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-xl sm:p-6"
    >
      {label && (
        <p className="text-sm text-text-secondary mb-2">{label}</p>
      )}
      <p className="break-words font-mono text-3xl font-bold leading-tight text-text-primary font-mono-nums sm:text-4xl md:text-5xl">
        {formatCurrency(monthlyTotal)}
      </p>
      <p className="mt-1 text-sm text-text-secondary">per month</p>
      {trend !== 0 && (
        <p
          className={`mt-2 text-sm font-medium ${
            isUp ? "text-danger" : isDown ? "text-success" : "text-text-secondary"
          }`}
        >
          {isUp ? "↑" : isDown ? "↓" : ""} {Math.abs(trend).toFixed(0)}% vs last month
        </p>
      )}
    </motion.div>
  );
}
