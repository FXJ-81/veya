"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

function daysInMonth(year: number, monthIndex: number): number {
  // monthIndex: 0-11
  return new Date(year, monthIndex + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, monthIndex: number): number {
  // 0 = Sunday ... 6 = Saturday
  return new Date(year, monthIndex, 1).getDay();
}

function clampMonth(year: number, monthIndex: number): { year: number; monthIndex: number } {
  if (monthIndex >= 0 && monthIndex <= 11) return { year, monthIndex };
  const d = new Date(year, monthIndex, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

function parseIsoDate(value: string | undefined): { year: number; monthIndex: number; day: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { year: y, monthIndex: mo - 1, day: d };
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function DateInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const selected = useMemo(() => parseIsoDate(value), [value]);
  const initialView = useMemo(() => {
    const base = selected ?? (() => {
      const now = new Date();
      return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
    })();
    return { year: base.year, monthIndex: base.monthIndex };
  }, [selected]);

  const [view, setView] = useState<{ year: number; monthIndex: number }>(initialView);
  useEffect(() => {
    // When value changes externally (reset/edit), keep view anchored to selection.
    if (!open) setView(initialView);
  }, [initialView, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (rootRef.current?.contains(t)) return;
      if (portalRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const monthLabel = useMemo(() => {
    const d = new Date(view.year, view.monthIndex, 1);
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
  }, [view.monthIndex, view.year]);

  const grid = useMemo(() => {
    const first = firstWeekdayOfMonth(view.year, view.monthIndex);
    const dim = daysInMonth(view.year, view.monthIndex);
    const cells: ({ kind: "blank" } | { kind: "day"; day: number })[] = [];
    for (let i = 0; i < first; i++) cells.push({ kind: "blank" });
    for (let d = 1; d <= dim; d++) cells.push({ kind: "day", day: d });
    // Pad to complete weeks (always stable 6 rows max, but we don’t force 42 unless needed).
    while (cells.length % 7 !== 0) cells.push({ kind: "blank" });
    // Some months need 6 rows; ensure grid doesn’t jump weirdly between 5/6-row months.
    if (cells.length < 35) {
      while (cells.length < 35) cells.push({ kind: "blank" });
    }
    return cells;
  }, [view.monthIndex, view.year]);

  const [portalPos, setPortalPos] = useState<{ left: number; top: number; width: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(320, r.width) - 8));
      const top = Math.min(r.bottom + 8, window.innerHeight - 360);
      setPortalPos({ left, top, width: Math.max(260, r.width) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const selectDay = (day: number) => {
    const iso = toIsoDate(view.year, view.monthIndex, day);
    onChange(iso);
    setOpen(false);
  };

  const goMonth = (delta: number) => {
    setView((v) => clampMonth(v.year, v.monthIndex + delta));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-left text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors",
          disabled && "opacity-60 pointer-events-none",
          className,
        )}
      >
        {value?.trim() ? (
          <span className="font-mono font-mono-nums">{value}</span>
        ) : (
          <span className="text-text-tertiary">{placeholder ?? "YYYY-MM-DD"}</span>
        )}
      </button>

      {mounted && open && portalPos
        ? createPortal(
            <div
              ref={portalRef}
              className="fixed z-[1000] rounded-xl border border-border bg-card shadow-2xl"
              style={{ left: portalPos.left, top: portalPos.top, width: portalPos.width }}
              role="dialog"
              aria-label="Calendar"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => goMonth(-1)}
                  className="min-h-[36px] min-w-[36px] rounded-lg border border-border bg-background-secondary/40 text-text-secondary hover:border-accent hover:text-accent"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="min-w-0 flex-1 text-center text-sm font-semibold text-text-primary">
                  {monthLabel}
                </div>
                <button
                  type="button"
                  onClick={() => goMonth(1)}
                  className="min-h-[36px] min-w-[36px] rounded-lg border border-border bg-background-secondary/40 text-text-secondary hover:border-accent hover:text-accent"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-text-tertiary">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {grid.map((c, idx) => {
                    if (c.kind === "blank") {
                      return <div key={`b-${idx}`} className="h-9" />;
                    }
                    const iso = toIsoDate(view.year, view.monthIndex, c.day);
                    const isSelected = value?.trim() === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => selectDay(c.day)}
                        className={cn(
                          "h-9 rounded-lg border border-transparent text-sm text-text-primary hover:border-accent hover:bg-background-secondary/40",
                          isSelected && "border-accent bg-background-secondary/60 text-accent",
                        )}
                      >
                        {c.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

