"use client";

import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Check,
  Clock,
  Globe2,
  Scale,
  Tag,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, LucideIcon> = {
  globe: Globe2,
  "trend-up": TrendingUp,
  check: Check,
  scale: Scale,
  tag: Tag,
  wallet: Wallet,
  alert: TriangleAlert,
  clock: Clock,
  calendar: Calendar,
};

export function InsightCardIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Tag;
  return <Icon className={cn("h-5 w-5 shrink-0 text-text-tertiary", className)} aria-hidden />;
}
