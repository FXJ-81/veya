"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Car,
  Cloud,
  Cpu,
  Film,
  Gamepad2,
  HeartPulse,
  Landmark,
  Music2,
  Newspaper,
  Package,
  Plane,
  ShoppingBag,
  Tv,
  UtensilsCrossed,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, LucideIcon> = {
  __total__: Wallet,
  Streaming: Tv,
  Music: Music2,
  Productivity: Briefcase,
  Storage: Cloud,
  Gaming: Gamepad2,
  Education: BookOpen,
  News: Newspaper,
  Health: HeartPulse,
  "Food & Dining": UtensilsCrossed,
  AI: Cpu,
  Transport: Car,
  Travel: Plane,
  Finance: Landmark,
  Utilities: Zap,
  Shopping: ShoppingBag,
  Entertainment: Film,
  Other: Package,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const Icon = MAP[category] ?? Package;
  return <Icon className={cn("h-4 w-4 shrink-0 text-text-tertiary", className)} aria-hidden />;
}
