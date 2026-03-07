"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import type { SpendingBreakdown } from "@/types";

const COLORS = ["#5b6ef5", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#9090aa"];

interface CategoryDonutProps {
  data: SpendingBreakdown[];
}

export function CategoryDonut({ data }: CategoryDonutProps) {
  const chartData = data.map((d) => ({
    name: d.category,
    value: d.total,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Category breakdown
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#111118",
                border: "1px solid #2a2a3a",
                borderRadius: "12px",
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}/mo`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
