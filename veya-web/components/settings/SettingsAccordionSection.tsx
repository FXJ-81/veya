"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SettingsAccordionSectionProps = {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export function SettingsAccordionSection({
  id,
  title,
  description,
  defaultOpen = false,
  className,
  children,
}: SettingsAccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  const triggerId = `${id}-trigger`;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/90 bg-card/80 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm",
        className,
      )}
      aria-labelledby={triggerId}
    >
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full min-h-[3.25rem] items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors sm:min-h-[3.5rem] sm:px-5 sm:py-4",
          "hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold tracking-tight text-text-primary">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-sm leading-snug text-text-secondary">{description}</span>
          ) : null}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background-secondary/40 text-text-secondary transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-border/70 px-4 pb-5 pt-1 sm:px-5 sm:pb-6 sm:pt-2">{children}</div>
        </div>
      </div>
    </section>
  );
}
