"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

interface AlternativeCardProps {
  title: string;
  name: string;
  price: number;
  billingCycle: string;
  savings?: number;
  isRecommended?: boolean;
}

export function AlternativeCard({
  title,
  name,
  price,
  billingCycle,
  savings,
  isRecommended,
}: AlternativeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 min-w-0"
    >
      <Card className={isRecommended ? "ring-2 ring-accent" : ""}>
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {title}
        </p>
        <h3 className="text-lg font-semibold text-text-primary mt-2">{name}</h3>
        <p className="font-mono text-2xl font-bold text-text-primary font-mono-nums mt-2">
          {formatCurrency(price)}
        </p>
        <p className="text-sm text-text-secondary">{billingCycle}</p>
        {savings !== undefined && savings > 0 && (
          <p className="mt-3 text-sm font-medium text-success">
            Save {formatCurrency(savings)}/year
          </p>
        )}
      </Card>
    </motion.div>
  );
}
