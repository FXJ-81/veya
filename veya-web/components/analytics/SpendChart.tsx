"use client";

import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";

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
      className="pointer-events-none max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border px-3 py-1.5 shadow-lg"
      style={{ background: "#111118", borderColor: "#2a2a3a" }}
    >
      <p className="text-sm font-medium text-text-primary">
        {row.label} {row.year}:{" "}
        <span className="font-mono text-accent">${total.toFixed(2)}</span>
      </p>
      <p className="mt-0.5 text-sm text-text-tertiary">{kind} · tap bar for breakdown</p>
    </div>
  );
}

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
      className="mt-4 overflow-hidden rounded-xl border"
      style={{ background: "#111118", borderColor: "#2a2a3a" }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#2a2a3a" }}>
        <p className="min-w-0 text-sm font-semibold text-text-primary">
          {normalized.label} {normalized.year}
          <span className="mx-1 font-normal text-text-tertiary">—</span>
          {kind}:{" "}
          <span className="font-mono text-accent">${total.toFixed(2)}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close breakdown"
          className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg p-2 text-lg leading-none text-text-tertiary transition-colors hover:bg-surface hover:text-text-primary md:min-h-0 md:min-w-0 md:p-1"
        >
          ✕
        </button>
      </div>

      <div style={{ maxHeight: "260px", overflowY: "auto" }}>
        {contributors.length > 0 ? (
          <ul className="divide-y" style={{ borderColor: "#1e1e2a" }}>
            {contributors.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between gap-4 px-4 py-2.5"
              >
                <span className="truncate text-sm text-text-primary">{c.name}</span>
                <span className="shrink-0 font-mono text-sm text-text-secondary">
                  ${c.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-text-tertiary">
            No subscriptions in this month.
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function SpendChart({ data }: SpendChartProps) {
  const rows = buildRows(data);
  const year = data[0]?.year ?? new Date().getFullYear();
  const [selected, setSelected] = useState<ChartRow | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const handleBarClick = (chartData: { activePayload?: { payload: ChartRow }[] } | null) => {
    const clicked = chartData?.activePayload?.[0]?.payload;
    if (!clicked) return;
    setSelected((prev) =>
      prev?.label === clicked.label && prev?.year === clicked.year ? null : clicked
    );
  };

  const chartMinWidth = narrow && rows.length > 6 ? Math.max(320, rows.length * 36) : 280;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-4 sm:p-6"
    >
      <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 pr-0 sm:pr-44">
          <h3 className="text-lg font-semibold text-text-primary">Monthly spend</h3>
          <p className="mt-0.5 text-sm text-text-secondary">
            {year} — actual through today, projected for remaining months
          </p>
        </div>
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center justify-end gap-3 font-medium text-text-secondary sm:absolute sm:right-0 sm:top-0 sm:gap-5",
            narrow ? "text-[11px]" : "text-sm",
          )}
        >
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

      <div className="min-w-0 w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <div
          className={cn("cursor-pointer", narrow ? "h-[250px]" : "h-72")}
          style={{ minWidth: chartMinWidth }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{
                top: 8,
                right: narrow ? 4 : 8,
                left: narrow ? 0 : 4,
                bottom: narrow ? 56 : 8,
              }}
              onClick={handleBarClick}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                dataKey="label"
                stroke="#9090aa"
                fontSize={narrow ? 10 : 12}
                tickLine={false}
                interval={0}
                tick={(props) => {
                  const { x, y, payload } = props;
                  const label = String(payload?.value ?? "");
                  const item = rows.find((r) => r.label === label);
                  const isCurrent = item?.period === "current";
                  const isSelected = selected?.label === label;
                  const fill = isSelected ? INDIGO_SELECTED : isCurrent ? ACCENT_TICK : "#9090aa";
                  const fw = isSelected || isCurrent ? 600 : 400;
                  if (narrow) {
                    return (
                      <text
                        x={x}
                        y={y}
                        fill={fill}
                        fontSize={10}
                        fontWeight={fw}
                        textAnchor="end"
                        transform={`rotate(-45 ${x} ${y})`}
                      >
                        {label}
                      </text>
                    );
                  }
                  return (
                    <text
                      x={x}
                      y={y + 12}
                      textAnchor="middle"
                      fill={fill}
                      fontSize={12}
                      fontWeight={fw}
                    >
                      {label}
                    </text>
                  );
                }}
              />
              <YAxis
                stroke="#9090aa"
                fontSize={narrow ? 10 : 12}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
                width={narrow ? 36 : undefined}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ outline: "none", maxWidth: "min(18rem, calc(100vw - 2rem))" }}
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
                    stroke={
                      selected?.label === entry.label && selected?.year === entry.year
                        ? INDIGO_SELECTED
                        : entry.stroke
                    }
                    strokeWidth={
                      selected?.label === entry.label && selected?.year === entry.year
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
