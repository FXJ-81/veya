"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import type { MonthlySpend } from "@/types";

interface SpendChartProps {
  data: MonthlySpend[];
}

const INDIGO = "#5b6ef5";
const INDIGO_CURRENT = "#8b9fff";
const INDIGO_FUTURE = "rgba(91, 110, 245, 0.4)";
const ACCENT_TICK = "#8b9fff";

type ChartRow = MonthlySpend & { fill: string; stroke: string; strokeDasharray: string };

function normalizeMonth(d: MonthlySpend): MonthlySpend {
  return {
    ...d,
    period: d.period ?? "past",
    contributors: Array.isArray(d.contributors) ? d.contributors : [],
    total: typeof d.total === "number" ? d.total : 0,
    label: d.label ?? "",
    year: d.year ?? new Date().getFullYear(),
    month: d.month ?? 1,
  };
}

function buildRows(data: MonthlySpend[]): ChartRow[] {
  return data.map((raw) => {
    const d = normalizeMonth(raw);
    if (d.period === "current") {
      return {
        ...d,
        fill: INDIGO_CURRENT,
        stroke: INDIGO_CURRENT,
        strokeDasharray: "0",
      };
    }
    if (d.period === "future") {
      return {
        ...d,
        fill: INDIGO_FUTURE,
        stroke: INDIGO,
        strokeDasharray: "4 4",
      };
    }
    return {
      ...d,
      fill: INDIGO,
      stroke: "transparent",
      strokeDasharray: "0",
    };
  });
}

function SpendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.payload;
  if (!raw) return null;
  const row = normalizeMonth(raw as MonthlySpend);
  const contributors = row.contributors;
  const isFuture = row.period === "future";
  const title = isFuture ? "Projected spend" : "Actual spend";
  const total = Number(row.total) || 0;

  return (
    <div className="rounded-xl border border-border bg-[#111118] px-3 py-2 shadow-lg max-w-xs">
      <p className="text-sm font-medium text-text-primary mb-1">
        {row.label} {row.year}
      </p>
      <p className="font-mono text-accent font-mono-nums text-base mb-2">
        {title}: ${total.toFixed(2)}
      </p>
      {contributors.length > 0 ? (
        <ul className="text-xs text-text-secondary space-y-1 border-t border-border pt-2 max-h-40 overflow-y-auto">
          {contributors.map((c) => (
            <li key={c.name} className="flex justify-between gap-4">
              <span className="truncate">{c.name}</span>
              <span className="font-mono shrink-0 font-mono-nums">${c.amount.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-tertiary">No subscriptions in this month.</p>
      )}
    </div>
  );
}

export function SpendChart({ data }: SpendChartProps) {
  const rows = buildRows(data);
  const year = data[0]?.year ?? new Date().getFullYear();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Monthly spend</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            {year} — actual through today, projected for remaining months
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-xs text-text-secondary font-medium">
          <span className="flex items-center gap-1.5">
            <span className="text-[#5b6ef5]" aria-hidden>
              ■
            </span>
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#5b6ef5] opacity-90" aria-hidden>
              □
            </span>
            Projected
          </span>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis
              dataKey="label"
              stroke="#9090aa"
              fontSize={11}
              tickLine={false}
              interval={0}
              tick={(props) => {
                const { x, y, payload } = props;
                const label = String(payload?.value ?? "");
                const item = rows.find((r) => r.label === label);
                const isCurrent = item?.period === "current";
                return (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    fill={isCurrent ? ACCENT_TICK : "#9090aa"}
                    fontSize={11}
                    fontWeight={isCurrent ? 600 : 400}
                  >
                    {label}
                  </text>
                );
              }}
            />
            <YAxis
              stroke="#9090aa"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={(props) => (
                <SpendTooltip
                  active={props.active}
                  payload={props.payload as { payload: ChartRow }[] | undefined}
                />
              )}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive>
              {rows.map((entry, index) => (
                <Cell
                  key={`cell-${entry.label}-${index}`}
                  fill={entry.fill}
                  stroke={entry.stroke}
                  strokeWidth={entry.period === "future" ? 2 : 0}
                  strokeDasharray={entry.strokeDasharray}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
