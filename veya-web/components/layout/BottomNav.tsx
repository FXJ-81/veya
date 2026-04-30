"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAIN_NAV } from "@/components/layout/navConfig";

/**
 * Mobile-only tab bar (`md:hidden` on root). Tablet/desktop use `Sidebar` unchanged.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] md:hidden"
      aria-label="Main navigation"
    >
      {/* Outer safe-area + horizontal inset so the bar reads as a floating pill, not edge-to-edge slab */}
      <div className="pointer-events-auto px-3 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-2">
        <div
          className={cn(
            "mx-auto max-w-lg overflow-hidden rounded-2xl border border-border/70",
            "bg-card/95 shadow-[0_-10px_36px_-14px_rgba(0,0,0,0.55)] backdrop-blur-xl",
            "px-0.5 py-1",
          )}
        >
          <div className="flex w-full items-stretch justify-evenly gap-0.5">
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
                    "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5",
                    "text-center text-[11px] font-semibold leading-tight text-text-tertiary",
                    "transition-colors duration-150",
                    active
                      ? "bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgba(91,110,245,0.28)]"
                      : "hover:bg-surface/70 hover:text-text-primary active:bg-surface/90",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      active ? "text-accent" : "text-text-tertiary",
                    )}
                    strokeWidth={active ? 2.25 : 2}
                    aria-hidden
                  />
                  <span className="line-clamp-2 w-full max-w-[5.25rem] break-words hyphens-auto">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
