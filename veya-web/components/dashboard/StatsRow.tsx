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
    <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          className="rounded-xl border border-border bg-card p-3"
        >
          <p className="text-sm text-text-tertiary uppercase tracking-wider">
            {stat.label}
          </p>
          <p className="mt-1 font-mono text-base font-semibold text-text-primary font-mono-nums lg:text-lg">
            {stat.value}
          </p>
          {stat.sub && (
            <p className="mt-0.5 text-sm text-text-secondary">{stat.sub}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
