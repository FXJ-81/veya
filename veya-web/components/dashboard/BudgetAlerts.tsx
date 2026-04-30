"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useBudgetStatuses } from "@/hooks/useBudgetStatus";

export function BudgetAlerts() {
  const { data: statuses = [], isLoading, isError } = useBudgetStatuses();

  if (isLoading || isError) return null;

  const alerts = statuses.filter((s) => s.percentage >= 80);
  if (alerts.length === 0) return null;

  const exceeded = alerts.filter((a) => a.percentage >= 100);
  const warning = alerts.filter((a) => a.percentage >= 80 && a.percentage < 100);

  return (
    <AnimatePresence>
      <div className="mb-2 space-y-3">
        {exceeded.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3"
          >
            <div className="flex items-start gap-2.5">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-red-300">Budget exceeded</p>
                <p className="mt-0.5 text-xs text-red-400">
                  {exceeded.map((a) => {
                    const label = a.category === "__total__" ? "Total" : a.category;
                    return `${label} over by $${Math.abs(a.remaining).toFixed(2)}`;
                  }).join(" · ")}
                </p>
              </div>
            </div>
            <Link
              href="/analytics"
              className="shrink-0 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
            >
              View →
            </Link>
          </motion.div>
        )}

        {warning.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-yellow-500/30 bg-yellow-950/40 px-4 py-3"
          >
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-yellow-300">Approaching budget limit</p>
                <p className="mt-0.5 text-xs text-yellow-400">
                  {warning.map((a) => {
                    const label = a.category === "__total__" ? "Total" : a.category;
                    return `${label} at ${a.percentage.toFixed(0)}%`;
                  }).join(" · ")}
                </p>
              </div>
            </div>
            <Link
              href="/analytics"
              className="shrink-0 rounded-lg border border-yellow-500/40 px-3 py-1.5 text-xs font-medium text-yellow-300 transition-colors hover:bg-yellow-900/40"
            >
              View →
            </Link>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
