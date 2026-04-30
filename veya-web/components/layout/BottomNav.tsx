"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAIN_NAV } from "@/components/layout/navConfig";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[55] border-t border-border bg-card/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-0.5 pt-1 sm:gap-0.5 sm:px-1">
        {MAIN_NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-0.5 py-1 text-[11px] font-medium leading-tight sm:text-xs",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 sm:h-5 sm:w-5" aria-hidden />
              <span className="mt-0.5 max-w-full truncate px-0.5 text-center leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
