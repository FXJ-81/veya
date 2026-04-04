"use client";

import { useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import type { MonthlySpend } from "@/types";

interface SpendChartProps {
  data: MonthlySpend[];
}

const INDIGO = "#5b6ef5";
const INDIGO_DIM = "#3a4aaa";
const INDIGO_CURRENT = "#8b9fff";
const INDIGO_CURRENT_DIM = "#5560bb";
const INDIGO_FUTURE = "rgba(91, 110, 245, 0.4)";
const INDIGO_FUTURE_DIM = "rgba(91, 110, 245, 0.18)";
const INDIGO_SELECTED = "#c4d0ff";
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
      return { ...d, fill: INDIGO_CURRENT, stroke: INDIGO_CURRENT, strokeDasharray: "0" };
    }
    if (d.period === "future") {
      return { ...d, fill: INDIGO_FUTURE, stroke: INDIGO, strokeDasharray: "4 4" };
    }
    return { ...d, fill: INDIGO, stroke: "transparent", strokeDasharray: "0" };
  });
}

function cellFill(entry: ChartRow, selected: ChartRow | null): string {
  if (!selected) return entry.fill;
  const isSelected = entry.label === selected.label && entry.year === selected.year;
  if (isSelected) return INDIGO_SELECTED;
  if (entry.period === "future") return INDIGO_FUTURE_DIM;
  if (entry.period === "current") return INDIGO_CURRENT_DIM;
  return INDIGO_DIM;
}

// ─── simple hover tooltip (total only) ───────────────────────────────────────

function HoverTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = normalizeMonth(payload[0]!.payload as MonthlySpend);
  const total = Number(row.total) || 0;
  const kind = row.period === "future" ? "Projected" : "Actual";
  return (
    <div
      className="rounded-lg border px-3 py-1.5 shadow-lg pointer-events-none"
      style={{ background: "#111118", borderColor: "#2a2a3a" }}
    >
      <p className="text-sm font-medium text-text-primary">
        {row.label} {row.year}:{" "}
        <span className="text-accent font-mono">${total.toFixed(2)}</span>
      </p>
      <p className="mt-0.5 text-sm text-text-tertiary">{kind} · tap bar for breakdown</p>
    </div>
  );
}

// ─── breakdown panel ──────────────────────────────────────────────────────────

function BreakdownPanel({
  row,
  onClose,
}: {
  row: ChartRow;
  onClose: () => void;
}) {
  const normalized = normalizeMonth(row);
  const total = Number(normalized.total) || 0;
  const kind = normalized.period === "future" ? "Projected spend" : "Actual spend";
  const contributors = [...normalized.contributors].sort((a, b) => b.amount - a.amount);

  return (
    <motion.div
      key={`${normalized.label}-${normalized.year}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mt-4 rounded-xl border overflow-hidden"
      style={{ background: "#111118", borderColor: "#2a2a3a" }}
    >
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#2a2a3a" }}>
        <p className="text-sm font-semibold text-text-primary">
          {normalized.label} {normalized.year}
          <span className="text-text-tertiary font-normal mx-1">—</span>
          {kind}:{" "}
          <span className="text-accent font-mono">${total.toFixed(2)}</span>
        </p>
        <button
          onClick={onClose}
          aria-label="Close breakdown"
          className="text-text-tertiary hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* scrollable list */}
      <div style={{ maxHeight: "260px", overflowY: "auto" }}>
        {contributors.length > 0 ? (
          <ul className="divide-y" style={{ borderColor: "#1e1e2a" }}>
            {contributors.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between gap-4 px-4 py-2.5"
              >
                <span className="text-sm text-text-primary truncate">{c.name}</span>
                <span className="text-sm font-mono text-text-secondary shrink-0">
                  ${c.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-text-tertiary text-center">
            No subscriptions in this month.
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function SpendChart({ data }: SpendChartProps) {
  const rows = buildRows(data);
  const year = data[0]?.year ?? new Date().getFullYear();
  const [selected, setSelected] = useState<ChartRow | null>(null);

  const handleBarClick = (chartData: { activePayload?: { payload: ChartRow }[] } | null) => {
    const clicked = chartData?.activePayload?.[0]?.payload;
    if (!clicked) return;
    setSelected((prev) =>
      prev?.label === clicked.label && prev?.year === clicked.year ? null : clicked
    );
  };

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
        <div className="flex flex-wrap items-center gap-5 text-sm font-medium text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="text-[#5b6ef5]" aria-hidden>■</span>
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#5b6ef5] opacity-90" aria-hidden>□</span>
            Projected
          </span>
        </div>
      </div>

      <div className="min-w-0 w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <div className="h-72 min-w-[280px] cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
            onClick={handleBarClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis
              dataKey="label"
              stroke="#9090aa"
              fontSize={12}
              tickLine={false}
              interval={0}
              tick={(props) => {
                const { x, y, payload } = props;
                const label = String(payload?.value ?? "");
                const item = rows.find((r) => r.label === label);
                const isCurrent = item?.period === "current";
                const isSelected = selected?.label === label;
                return (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    fill={isSelected ? INDIGO_SELECTED : isCurrent ? ACCENT_TICK : "#9090aa"}
                    fontSize={12}
                    fontWeight={isSelected || isCurrent ? 600 : 400}
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
                <HoverTooltip
                  active={props.active}
                  payload={props.payload as { payload: ChartRow }[] | undefined}
                />
              )}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive>
              {rows.map((entry, index) => (
                <Cell
                  key={`cell-${entry.label}-${index}`}
                  fill={cellFill(entry, selected)}
                  stroke={selected?.label === entry.label && selected?.year === entry.year
                    ? INDIGO_SELECTED
                    : entry.stroke}
                  strokeWidth={
                    (selected?.label === entry.label && selected?.year === entry.year)
                      ? 2
                      : entry.period === "future"
                      ? 2
                      : 0
                  }
                  strokeDasharray={entry.strokeDasharray}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* breakdown panel */}
      <AnimatePresence mode="wait">
        {selected && (
          <BreakdownPanel
            key={`${selected.label}-${selected.year}`}
            row={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
