"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/subscriptions", label: "Subscriptions", icon: "📋" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/coach", label: "AI Coach", icon: "💬" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [tabletMenuOpen, setTabletMenuOpen] = useState(false);

  useEffect(() => {
    setTabletMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = tabletMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [tabletMenuOpen]);

  const navContent = (
    <>
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="text-2xl font-bold tracking-tight text-text-primary">
          Veya
        </Link>
        <button
          type="button"
          onClick={() => setTabletMenuOpen(false)}
          className="rounded-lg p-2 text-text-secondary hover:bg-surface hover:text-text-primary lg:hidden"
          aria-label="Close menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="mt-3 space-y-1 px-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex min-h-[48px] items-center gap-3 rounded-lg px-4 py-3 text-[15px] font-medium leading-snug transition-colors",
              pathname === link.href
                ? "bg-accent/20 text-accent"
                : "text-text-secondary hover:bg-surface hover:text-text-primary",
            )}
          >
            <span className="text-xl leading-none" aria-hidden>
              {link.icon}
            </span>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 border-t border-border p-2">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 py-3 text-[15px] text-text-secondary hover:bg-surface hover:text-danger"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Tablet: top bar + hamburger (768px–1023px); hidden on mobile and on desktop */}
      <div className="fixed left-0 right-0 top-0 z-40 hidden h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-xl md:flex lg:hidden">
        <button
          type="button"
          onClick={() => setTabletMenuOpen(true)}
          className="min-h-[44px] min-w-[44px] rounded-lg text-xl leading-none text-text-secondary hover:bg-surface hover:text-text-primary"
          aria-label="Open menu"
        >
          ☰
        </button>
        <Link href="/dashboard" className="text-xl font-bold tracking-tight text-text-primary">
          Veya
        </Link>
        <span className="min-w-[44px]" aria-hidden />
      </div>

      {/* Desktop (1024px+): fixed rail */}
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen shrink-0 border-r border-border bg-card/80 backdrop-blur-xl lg:block"
        style={{ width: "var(--app-sidebar-width)" }}
      >
        {navContent}
      </aside>

      {/* Tablet drawer overlay */}
      <AnimatePresence>
        {tabletMenuOpen && (
          <>
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm md:block lg:hidden"
              onClick={() => setTabletMenuOpen(false)}
            />
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-screen max-w-[85vw] border-r border-border bg-card backdrop-blur-xl md:block lg:hidden"
              style={{ width: "var(--app-sidebar-width)" }}
            >
              {navContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
