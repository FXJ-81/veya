"use client";

import { motion } from "framer-motion";
import { formatCurrency, formatDate, getDaysUntil } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Subscription } from "@/types";

interface SubscriptionCardProps {
  subscription: Subscription;
  index: number;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onSeeAlternative?: (sub: Subscription) => void;
  alternative?: { name: string; price: number; savings: number };
}

export function SubscriptionCard({
  subscription,
  index,
  onPause,
  onCancel,
  onSeeAlternative,
  alternative,
}: SubscriptionCardProps) {
  const days = getDaysUntil(new Date(subscription.nextRenewal));
  const statusVariant =
    subscription.status === "paused"
      ? "warning"
      : subscription.status === "cancelled"
        ? "danger"
        : "default";
  const renewalVariant = days <= 3 ? "danger" : days <= 7 ? "warning" : "success";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center text-xl"
            style={subscription.color ? { backgroundColor: subscription.color + "40" } : undefined}
          >
            {subscription.logoUrl ? (
              <img
                src={subscription.logoUrl}
                alt=""
                className="h-8 w-8 object-contain"
              />
            ) : (
              <span className="font-bold text-text-primary">
                {subscription.name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{subscription.name}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="default">{subscription.category}</Badge>
              <Badge variant={statusVariant}>{subscription.status}</Badge>
              <Badge variant={renewalVariant}>
                {days <= 0 ? "Due" : `Renews in ${days}d`}
              </Badge>
            </div>
            <p className="font-mono text-accent font-mono-nums mt-2">
              {formatCurrency(subscription.price)} / {subscription.billingCycle}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Next: {formatDate(subscription.nextRenewal)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {subscription.status === "active" && onPause && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPause(subscription.id)}
            >
              Pause
            </Button>
          )}
          {onCancel && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onCancel(subscription.id)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
      {alternative && onSeeAlternative && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-text-secondary">
            Cheaper option: <strong className="text-success">{alternative.name}</strong> — save{" "}
            <span className="font-mono text-success font-mono-nums">
              {formatCurrency(alternative.savings)}/yr
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSeeAlternative(subscription)}
          >
            Compare
          </Button>
        </div>
      )}
    </motion.div>
  );
}
