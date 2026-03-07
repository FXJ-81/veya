"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatCurrency, formatDate, getDaysUntil } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { Subscription } from "@/types";

interface RenewalCardProps {
  subscription: Subscription;
  index: number;
}

export function RenewalCard({ subscription, index }: RenewalCardProps) {
  const days = getDaysUntil(new Date(subscription.nextRenewal));
  const variant =
    days <= 3 ? "danger" : days <= 7 ? "warning" : "success";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.05 }}
      className="flex-shrink-0 w-48 rounded-xl border border-border bg-card p-4"
    >
      <p className="font-medium text-text-primary truncate">{subscription.name}</p>
      <p className="font-mono text-lg font-semibold text-accent font-mono-nums mt-1">
        {formatCurrency(subscription.price)}
      </p>
      <p className="text-xs text-text-secondary mt-1">
        {subscription.billingCycle}
      </p>
      <Badge variant={variant} className="mt-2">
        {days <= 0 ? "Due" : `${days} days`}
      </Badge>
      <p className="text-xs text-text-tertiary mt-1">
        {formatDate(subscription.nextRenewal)}
      </p>
    </motion.div>
  );
}
