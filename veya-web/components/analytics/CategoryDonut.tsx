"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import type { SpendingBreakdown } from "@/types";
import { categoryColorAt } from "@/lib/subscriptionBilling";
import { cn } from "@/lib/utils";

interface CategoryDonutProps {
  data: SpendingBreakdown[];
  /** Dashboard: chart left + legend right from `sm` (640px); stacked on smaller screens. */
  variant?: "default" | "split";
  className?: string;
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
    <div className="max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-[#111118] px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-text-primary">{row.category}</p>
      <p className="font-mono text-accent font-mono-nums">
        ${row.value.toFixed(2)}
        <span className="text-sm font-sans text-text-secondary"> /mo</span>
      </p>
      <p className="text-sm text-text-tertiary">{row.percentage.toFixed(1)}% of spend</p>
    </div>
  );
}

export function CategoryDonut({ data, variant = "default", className }: CategoryDonutProps) {
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

  const pieChart = (
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
  );

  if (variant === "split") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 sm:p-6",
          className,
        )}
      >
        <h3 className="mb-4 shrink-0 text-lg font-semibold text-text-primary">Category breakdown</h3>
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-0">
          <div className="flex w-full shrink-0 justify-center sm:w-1/2 sm:justify-center">
            <div className="h-[180px] w-full max-w-[180px] sm:h-[220px] sm:max-w-[220px]">
              <ResponsiveContainer width="100%" height="100%">{pieChart}</ResponsiveContainer>
            </div>
          </div>
          <ul className="flex w-full min-w-0 flex-col justify-center gap-3 border-t border-border pt-5 sm:w-1/2 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            {rows.map((row) => (
              <li
                key={row.category}
                className="flex w-full min-w-0 items-center gap-2.5 text-sm sm:gap-3"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-text-primary">{row.category}</span>
                <span className="shrink-0 text-right font-mono text-xs font-mono-nums tabular-nums text-text-secondary sm:text-sm">
                  ${row.value.toFixed(2)}
                  <span className="ml-2 text-text-tertiary">{row.percentage.toFixed(0)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="w-full min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6"
    >
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Category breakdown</h3>
      <div className="h-40 min-h-[10rem] w-full min-w-0 sm:h-52 sm:min-h-[12rem] md:h-56 md:min-h-[14rem]">
        <ResponsiveContainer width="100%" height="100%">{pieChart}</ResponsiveContainer>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-2">
        {rows.map((row) => (
          <li
            key={row.category}
            className="flex min-w-0 items-center justify-between gap-2 text-xs sm:gap-3 sm:text-sm"
          >
            <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <span className="truncate text-text-primary">{row.category}</span>
            </span>
            <span className="shrink-0 text-right font-mono text-text-secondary font-mono-nums text-[11px] tabular-nums sm:text-sm">
              ${row.value.toFixed(2)}
              <span className="ml-1.5 text-text-tertiary">{row.percentage.toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
