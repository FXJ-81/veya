"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/subscriptions", label: "Subs", icon: "📋" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/coach", label: "Coach", icon: "💬" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[55] border-t border-border bg-card/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-1 pt-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-0.5 py-1 text-sm font-medium leading-tight",
                active ? "text-accent" : "text-text-secondary",
              )}
            >
              <span className="text-[1.125rem] leading-none" aria-hidden>
                {item.icon}
              </span>
              <span className="mt-0.5 max-w-full truncate px-0.5 text-center text-sm">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
