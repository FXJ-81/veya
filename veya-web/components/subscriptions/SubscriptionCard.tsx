"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { pricePerMonthAt } from "@/lib/subscriptionBilling";
import { getEffectiveRenewal } from "@/lib/subscriptionRenewal";
import {
  accentHueForName,
  resolveSubscriptionLogoUrl,
} from "@/lib/subscriptionLogo";
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
  /** Opens cancel confirmation; subscription is not changed until the user confirms. */
  onCancelRequest?: (sub: Subscription) => void;
  onEdit?: (sub: Subscription) => void;
  onSeeAlternative?: (sub: Subscription) => void;
  alternative?: { name: string; price: number; savings: number };
}

export function SubscriptionCard({
  subscription,
  index,
  onPause,
  onCancelRequest,
  onEdit,
  onSeeAlternative,
  alternative,
}: SubscriptionCardProps) {
  const renewal = getEffectiveRenewal(subscription);
  const days =
    renewal.isPaused || !Number.isFinite(renewal.daysUntil)
      ? null
      : renewal.daysUntil;

  const statusVariant =
    subscription.status === "paused"
      ? "warning"
      : subscription.status === "cancelled"
        ? "danger"
        : "default";

  const renewalVariant =
    renewal.isPaused
      ? "default"
      : days !== null && days <= 3
        ? "danger"
        : days !== null && days <= 7
          ? "warning"
          : "success";

  const perMo = pricePerMonthAt(subscription, new Date());
  const showMonthlyHint =
    subscription.billingCycle === "weekly" || subscription.billingCycle === "yearly";

  const logoSrc = resolveSubscriptionLogoUrl(
    subscription.name,
    subscription.logoUrl
  );
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [subscription.id, subscription.name, subscription.logoUrl, logoSrc]);

  const showImg = logoSrc && !logoFailed;
  const initial = subscription.name.trim().charAt(0).toUpperCase() || "?";
  const hue = accentHueForName(subscription.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="w-full min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div
            className="h-12 w-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden"
            style={
              subscription.color && !showImg
                ? { backgroundColor: subscription.color + "55" }
                : showImg
                  ? { backgroundColor: "rgba(255,255,255,0.06)" }
                  : { backgroundColor: `hsl(${hue} 55% 32%)` }
            }
          >
            {showImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="h-8 w-8 object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="text-lg font-bold text-white">{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="font-semibold text-text-primary">{subscription.name}</h3>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(subscription)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-background-secondary hover:text-accent md:min-h-0 md:min-w-0"
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
                {renewal.isPaused
                  ? "Paused"
                  : days !== null
                    ? days <= 0
                      ? "Due"
                      : `Renews in ${days}d`
                    : "—"}
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
              Next: {renewal.displayLine}
            </p>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:shrink-0">
          {subscription.status === "paused" && onPause && (
            <Button
              variant="success"
              size="sm"
              className="max-md:px-3 max-md:text-xs"
              onClick={() => onPause(subscription.id)}
            >
              Resume
            </Button>
          )}
          {subscription.status === "active" && onPause && (
            <Button
              variant="secondary"
              size="sm"
              className="max-md:px-3 max-md:text-xs"
              onClick={() => onPause(subscription.id)}
            >
              Pause
            </Button>
          )}
          {onCancelRequest && (
            <Button
              variant="danger"
              size="sm"
              className="max-md:px-3 max-md:text-xs"
              onClick={() => onCancelRequest(subscription)}
            >
              Cancel in Veya
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
