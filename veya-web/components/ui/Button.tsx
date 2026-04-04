"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
    const variants = {
      primary: "bg-accent text-white hover:opacity-90",
      secondary: "border border-border bg-surface text-text-primary hover:bg-border/50",
      ghost: "text-text-secondary hover:bg-surface hover:text-text-primary",
      danger: "bg-danger/20 text-danger hover:bg-danger/30",
      success: "bg-success text-white hover:opacity-90",
    };
    const sizes = {
      sm: "px-3 py-1.5 text-sm max-md:min-h-[44px] max-md:py-2.5",
      md: "px-5 py-2.5 text-sm max-md:min-h-[44px]",
      lg: "px-8 py-4 text-base max-md:min-h-[44px]",
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
export { Button };
