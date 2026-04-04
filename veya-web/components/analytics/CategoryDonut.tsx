"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import type { SpendingBreakdown } from "@/types";
import { categoryColorAt } from "@/lib/subscriptionBilling";

interface CategoryDonutProps {
  data: SpendingBreakdown[];
}

type Row = { name: string; value: number; category: string; percentage: number; color: string };

type DonutTooltipProps = {
  active?: boolean;
  payload?: { payload?: Row }[];
};

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-border bg-[#111118] px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-text-primary">{row.category}</p>
      <p className="font-mono text-accent font-mono-nums">
        ${row.value.toFixed(2)}
        <span className="text-sm font-sans text-text-secondary"> /mo</span>
      </p>
      <p className="text-sm text-text-tertiary">{row.percentage.toFixed(1)}% of spend</p>
    </div>
  );
}

export function CategoryDonut({ data }: CategoryDonutProps) {
  const rows: Row[] = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.total - a.total);
    const sum = sorted.reduce((s, d) => s + d.total, 0);
    return sorted.map((d, i) => {
      const pct =
        d.percentage !== undefined
          ? d.percentage
          : sum > 0
            ? (d.total / sum) * 100
            : sorted.length === 1
              ? 100
              : 0;
      return {
        name: d.category,
        value: d.total,
        category: d.category,
        percentage: pct,
        color: categoryColorAt(i),
      };
    });
  }, [data]);

  const hasData = rows.length > 0 && rows.some((r) => r.value > 0);

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Category breakdown</h3>
        <p className="text-sm text-text-secondary">No category data yet.</p>
      </motion.div>
    );
  }

  const single = rows.length === 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="w-full min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6"
    >
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Category breakdown</h3>
      <div className="h-52 min-h-[12rem] w-full min-w-0 sm:h-56 sm:min-h-[14rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={single ? 0 : 2}
              stroke="none"
              isAnimationActive
            >
              {rows.map((entry, i) => (
                <Cell key={`cell-${entry.category}-${i}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              content={(props) => (
                <DonutTooltip
                  active={props.active}
                  payload={props.payload as DonutTooltipProps["payload"]}
                />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 space-y-2 border-t border-border pt-4">
        {rows.map((row) => (
          <li
            key={row.category}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <span className="truncate text-text-primary">{row.category}</span>
            </span>
            <span className="shrink-0 text-right font-mono text-text-secondary font-mono-nums">
              ${row.value.toFixed(2)}
              <span className="ml-2 text-text-tertiary">{row.percentage.toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
