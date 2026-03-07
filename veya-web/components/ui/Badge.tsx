"use client";

import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "accent";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-surface text-text-secondary border-border",
    success: "bg-success/20 text-success border-success/40",
    warning: "bg-warning/20 text-warning border-warning/40",
    danger: "bg-danger/20 text-danger border-danger/40",
    accent: "bg-accent/20 text-accent border-accent/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
