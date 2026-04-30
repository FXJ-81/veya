"use client";

import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
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

const C_BAR_PAST = "rgb(var(--accent) / 0.95)";
const C_BAR_CURRENT = "rgb(var(--accent) / 0.72)";
const C_BAR_FUTURE = "rgb(var(--accent) / 0.28)";
const C_BAR_DIM = "rgb(var(--accent) / 0.22)";
const C_BAR_SELECTED = "rgb(var(--accent) / 0.22)";
const C_STROKE_FUTURE = "rgb(var(--accent) / 0.85)";
const C_STROKE_SELECTED = "rgb(var(--accent) / 0.9)";
const C_AXIS = "rgb(var(--text-tertiary) / 1)";
const C_GRID = "rgb(var(--border) / 1)";
const C_CURSOR = "rgb(var(--accent) / 0.08)";

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
      return { ...d, fill: C_BAR_CURRENT, stroke: "transparent", strokeDasharray: "0" };
    }
    if (d.period === "future") {
      return { ...d, fill: C_BAR_FUTURE, stroke: C_STROKE_FUTURE, strokeDasharray: "4 4" };
    }
    return { ...d, fill: C_BAR_PAST, stroke: "transparent", strokeDasharray: "0" };
  });
}

function cellFill(entry: ChartRow, selected: ChartRow | null): string {
  if (!selected) return entry.fill;
  const isSelected = entry.label === selected.label && entry.year === selected.year;
  if (isSelected) return C_BAR_SELECTED;
  return C_BAR_DIM;
}

/** Chart (SVG) coordinates → viewport pixels; respects scroll, zoom, and margins. */
function svgDataPointToClient(svg: SVGSVGElement, x: number, y: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x, y };
  const p = new DOMPoint(x, y).matrixTransform(ctm);
  return { x: p.x, y: p.y };
}

const TOOLTIP_VIEWPORT_PAD = 8;
const TOOLTIP_ANCHOR_GAP = 10;
const TOOLTIP_MAX_WIDTH = "min(18rem, calc(100vw - 2rem))";

function SpendTooltipPortal({
  active,
  payload,
  coordinate,
  chartRootRef,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  coordinate?: { x?: number; y?: number };
  chartRootRef: RefObject<HTMLDivElement | null>;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (
      !active ||
      !coordinate ||
      typeof coordinate.x !== "number" ||
      typeof coordinate.y !== "number"
    ) {
      setPos(null);
      return;
    }
    const svg = chartRootRef.current?.querySelector(".recharts-surface") as SVGSVGElement | null;
    if (!svg) {
      setPos(null);
      return;
    }
    const anchor = svgDataPointToClient(svg, coordinate.x, coordinate.y);
    const el = tipRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = TOOLTIP_VIEWPORT_PAD;
    const gap = TOOLTIP_ANCHOR_GAP;

    const tw = el?.offsetWidth ?? 0;
    const th = el?.offsetHeight ?? 0;
    const w = tw > 0 ? tw : Math.min(288, vw - 2 * pad);
    const h = th > 0 ? th : 72;

    let left = anchor.x - w / 2;
    let top = anchor.y - h - gap;
    if (top < pad) top = anchor.y + gap;

    left = Math.min(Math.max(left, pad), vw - pad - w);
    top = Math.min(Math.max(top, pad), vh - pad - h);

    setPos({ left, top });
  }, [active, chartRootRef, coordinate?.x, coordinate?.y]);

  useLayoutEffect(() => {
    if (!active || !payload?.length) {
      setPos(null);
      return;
    }
    updatePosition();
    const raf = requestAnimationFrame(() => updatePosition());
    const onWin = () => updatePosition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    const el = tipRef.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updatePosition()) : null;
    if (el) ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
      ro?.disconnect();
    };
  }, [active, payload, updatePosition]);

  if (!active || !payload?.length || typeof document === "undefined") return null;

  const row = normalizeMonth(payload[0]!.payload as MonthlySpend);
  const total = Number(row.total) || 0;
  const kind = row.period === "future" ? "Projected" : "Actual";

  return createPortal(
    <div
      ref={tipRef}
      className="pointer-events-none fixed z-[1000] rounded-lg border border-border bg-card px-3 py-1.5 shadow-lg"
      style={{
        maxWidth: TOOLTIP_MAX_WIDTH,
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <p className="text-sm font-medium text-text-primary">
        {row.label} {row.year}:{" "}
        <span className="font-mono text-accent">${total.toFixed(2)}</span>
      </p>
      <p className="mt-0.5 text-sm text-text-tertiary">{kind} · tap bar for breakdown</p>
    </div>,
    document.body,
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
      className="mt-4 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
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
          <ul className="divide-y divide-border">
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
  const chartPortalRootRef = useRef<HTMLDivElement>(null);

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
  const needsHorizontalScroll = narrow && rows.length > 8;

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
            <span className="text-accent" aria-hidden>
              ■
            </span>
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-accent opacity-90" aria-hidden>
              □
            </span>
            Projected
          </span>
        </div>
      </div>

      <div
        className={cn(
          "min-w-0 w-full [-webkit-overflow-scrolling:touch]",
          needsHorizontalScroll ? "overflow-x-auto" : "overflow-x-hidden",
        )}
      >
        <div
          ref={chartPortalRootRef}
          className={cn("cursor-pointer", narrow ? "h-[250px]" : "h-72")}
          style={{ minWidth: needsHorizontalScroll ? chartMinWidth : undefined }}
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
              <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} />
              <XAxis
                dataKey="label"
                stroke={C_AXIS}
                fontSize={narrow ? 10 : 12}
                tickLine={false}
                interval={0}
                tick={(props) => {
                  const { x, y, payload } = props;
                  const label = String(payload?.value ?? "");
                  const item = rows.find((r) => r.label === label);
                  const isCurrent = item?.period === "current";
                  const isSelected = selected?.label === label;
                  const fill = isSelected || isCurrent ? "rgb(var(--accent) / 0.95)" : C_AXIS;
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
                stroke={C_AXIS}
                fontSize={narrow ? 10 : 12}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
                width={narrow ? 36 : undefined}
              />
              <Tooltip
                cursor={{ fill: C_CURSOR }}
                wrapperStyle={{ display: "none" }}
                content={(props) => (
                  <SpendTooltipPortal
                    chartRootRef={chartPortalRootRef}
                    active={props.active}
                    payload={props.payload as { payload: ChartRow }[] | undefined}
                    coordinate={props.coordinate}
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
                        ? C_STROKE_SELECTED
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
