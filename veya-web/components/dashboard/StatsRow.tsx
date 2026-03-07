"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string | number;
  sub?: string;
}

interface StatsRowProps {
  stats: StatItem[];
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <p className="text-xs text-text-tertiary uppercase tracking-wider">
            {stat.label}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-text-primary font-mono-nums">
            {stat.value}
          </p>
          {stat.sub && (
            <p className="mt-0.5 text-xs text-text-secondary">{stat.sub}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
