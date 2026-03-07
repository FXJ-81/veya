"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import type { MonthlySpend } from "@/types";

interface SpendChartProps {
  data: MonthlySpend[];
}

export function SpendChart({ data }: SpendChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Monthly spend
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis
              dataKey="label"
              stroke="#9090aa"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#9090aa"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111118",
                border: "1px solid #2a2a3a",
                borderRadius: "12px",
              }}
              labelStyle={{ color: "#f8f8ff" }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Spend"]}
            />
            <Bar dataKey="total" fill="#5b6ef5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
