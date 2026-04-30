"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/subscriptions", label: "Subscriptions", icon: "📋" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/coach", label: "AI Coach", icon: "💬" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const;

function pathActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function VeyaMark() {
  return (
    <Link
      href="/"
      className="inline-flex select-none items-baseline gap-0.5 font-bold tracking-tight text-text-primary transition-opacity hover:opacity-90"
    >
      <span className="text-2xl leading-none sm:text-[1.7rem] md:text-[1.75rem]">
        Veya
      </span>
      <span
        className="ml-0.5 h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_14px_rgba(91,110,245,0.6)]"
        aria-hidden
      />
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Tablet + desktop (md+): floating rail; phone uses BottomNav only (<md, unchanged) */}
      <aside
        className="pointer-events-none fixed left-0 top-0 z-40 hidden h-full w-[var(--app-sidebar-width)] md:flex md:flex-col"
        aria-label="Main navigation"
      >
        <div className="pointer-events-auto flex shrink-0 flex-col px-6 pb-3 pt-8 md:pt-9">
          <VeyaMark />
        </div>

        <div className="pointer-events-none flex min-h-0 flex-1 flex-col px-5 pb-8 pt-2 md:px-5 md:pb-10 md:pt-4">
          <div className="pointer-events-auto flex h-full min-h-0 w-full flex-1 flex-col">
            <nav
              className={cn(
                "flex min-h-0 flex-1 flex-col rounded-3xl border border-border/85 bg-card/90 p-3 md:p-3.5",
                "md:min-h-[min(68dvh,34rem)] lg:min-h-[min(72dvh,38rem)]",
                "shadow-[0_14px_48px_-10px_rgba(0,0,0,0.78)] backdrop-blur-xl",
                "ring-1 ring-white/[0.06]",
              )}
            >
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 py-2 md:gap-2.5 md:py-3 lg:gap-3 lg:py-4">
                {NAV_LINKS.map((link) => {
                  const active = pathActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex min-h-[52px] items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium leading-snug transition-colors duration-200",
                        "md:min-h-[54px] md:px-4 md:py-3.5 lg:min-h-[56px]",
                        active
                          ? "bg-accent/20 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "text-text-secondary hover:bg-white/[0.06] hover:text-text-primary",
                      )}
                    >
                      <span className="text-xl leading-none opacity-95 md:text-[1.35rem]" aria-hidden>
                        {link.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="shrink-0 px-0.5 pb-1 pt-1 md:pt-2">
                <div
                  className="mb-3 h-px bg-gradient-to-r from-transparent via-border to-transparent md:mb-3.5"
                  role="separator"
                />

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={cn(
                    "flex min-h-[48px] w-full items-center rounded-xl px-3.5 py-2.5 text-left text-sm font-medium md:min-h-[50px] md:px-4",
                    "text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger",
                  )}
                >
                  Sign out
                </button>
              </div>
            </nav>
          </div>
        </div>
      </aside>
    </>
  );
}
