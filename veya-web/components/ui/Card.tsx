"use client";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export function Card({ className, glass, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border p-6",
        glass ? "bg-card/80 backdrop-blur-xl" : "bg-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
