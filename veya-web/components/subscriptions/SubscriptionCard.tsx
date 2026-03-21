"use client";

import { motion } from "framer-motion";
import { formatCurrency, formatDate, getDaysUntil } from "@/lib/utils";
import { pricePerMonth } from "@/lib/subscriptionBilling";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Subscription } from "@/types";

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

interface SubscriptionCardProps {
  subscription: Subscription;
  index: number;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (sub: Subscription) => void;
  onSeeAlternative?: (sub: Subscription) => void;
  alternative?: { name: string; price: number; savings: number };
}

export function SubscriptionCard({
  subscription,
  index,
  onPause,
  onCancel,
  onEdit,
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
  const perMo = pricePerMonth(subscription.price, subscription.billingCycle);
  const showMonthlyHint =
    subscription.billingCycle === "weekly" || subscription.billingCycle === "yearly";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div
            className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center text-xl shrink-0"
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
          <div className="min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="font-semibold text-text-primary">{subscription.name}</h3>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(subscription)}
                  className="rounded-lg p-1.5 text-text-tertiary hover:text-accent hover:bg-background-secondary transition-colors"
                  aria-label={`Edit ${subscription.name}`}
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {subscription.notes?.trim() ? (
              <p className="text-sm text-text-tertiary mt-1 line-clamp-3 whitespace-pre-wrap">
                {subscription.notes.trim()}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="default">{subscription.category}</Badge>
              <Badge variant={statusVariant}>{subscription.status}</Badge>
              <Badge variant={renewalVariant}>
                {days <= 0 ? "Due" : `Renews in ${days}d`}
              </Badge>
            </div>
            <p className="font-mono text-accent font-mono-nums mt-2">
              {formatCurrency(subscription.price)} / {subscription.billingCycle}
            </p>
            {showMonthlyHint ? (
              <p className="text-xs text-text-tertiary mt-0.5">
                ≈ {formatCurrency(perMo)}/mo normalized
              </p>
            ) : null}
            <p className="text-xs text-text-tertiary mt-1">
              Next: {formatDate(subscription.nextRenewal)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
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
