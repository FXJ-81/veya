"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { getEffectiveRenewal } from "@/lib/subscriptionRenewal";
import type { Subscription } from "@/types";

interface RenewalCardProps {
  subscription: Subscription;
  index: number;
}

export function RenewalCard({ subscription, index }: RenewalCardProps) {
  const renewal = getEffectiveRenewal(subscription);
  const days =
    renewal.isPaused || !Number.isFinite(renewal.daysUntil)
      ? null
      : renewal.daysUntil;

  const variant =
    renewal.isPaused
      ? "default"
      : days !== null && days <= 3
        ? "danger"
        : days !== null && days <= 7
          ? "warning"
          : "success";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.05 }}
      className="w-48 shrink-0 rounded-xl border border-border bg-card p-3"
    >
      <p className="font-medium text-text-primary truncate">{subscription.name}</p>
      <p className="font-mono text-lg font-semibold text-accent font-mono-nums mt-1">
        {formatCurrency(subscription.price)}
      </p>
      <p className="text-xs text-text-secondary mt-1">
        {subscription.billingCycle}
      </p>
      <Badge variant={variant} className="mt-2">
        {renewal.isPaused
          ? "Paused"
          : days !== null
            ? days <= 0
              ? "Due"
              : `${days} days`
            : "—"}
      </Badge>
      <p className="text-xs text-text-tertiary mt-1">{renewal.displayLine}</p>
    </motion.div>
  );
}
