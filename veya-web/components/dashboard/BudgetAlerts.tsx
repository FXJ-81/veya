"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { BudgetStatus } from "@/app/api/budgets/status/route";

export function BudgetAlerts() {
  const [alerts, setAlerts] = useState<BudgetStatus[]>([]);

  useEffect(() => {
    fetch("/api/budgets/status")
      .then((r) => r.json())
      .then((j) => {
        const at80plus = (j.statuses as BudgetStatus[] ?? []).filter(
          (s) => s.percentage >= 80
        );
        setAlerts(at80plus);
      })
      .catch(() => {});
  }, []);

  if (alerts.length === 0) return null;

  const exceeded = alerts.filter((a) => a.percentage >= 100);
  const warning = alerts.filter((a) => a.percentage >= 80 && a.percentage < 100);

  return (
    <AnimatePresence>
      <div className="space-y-3 mb-2">
        {exceeded.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg shrink-0">🚨</span>
              <div>
                <p className="text-sm font-semibold text-red-300">Budget exceeded</p>
                <p className="text-xs text-red-400 mt-0.5">
                  {exceeded.map((a) => {
                    const label = a.category === "__total__" ? "Total" : a.category;
                    return `${label} over by $${Math.abs(a.remaining).toFixed(2)}`;
                  }).join(" · ")}
                </p>
              </div>
            </div>
            <Link
              href="/budget"
              className="shrink-0 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/40 transition-colors"
            >
              View →
            </Link>
          </motion.div>
        )}

        {warning.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-yellow-500/30 bg-yellow-950/40 px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-yellow-300">Approaching budget limit</p>
                <p className="text-xs text-yellow-400 mt-0.5">
                  {warning.map((a) => {
                    const label = a.category === "__total__" ? "Total" : a.category;
                    return `${label} at ${a.percentage.toFixed(0)}%`;
                  }).join(" · ")}
                </p>
              </div>
            </div>
            <Link
              href="/budget"
              className="shrink-0 rounded-lg border border-yellow-500/40 px-3 py-1.5 text-xs font-medium text-yellow-300 hover:bg-yellow-900/40 transition-colors"
            >
              View →
            </Link>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
