"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 min-w-0 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-[44px] shrink-0 items-center text-xl font-bold leading-none text-text-primary"
        >
          Veya
        </Link>

        <div className="hidden min-w-0 items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              {l.label}
            </a>
          ))}
          {status === "loading" ? (
            <span className="text-sm text-text-tertiary">...</span>
          ) : session ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm text-text-secondary hover:text-text-primary">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {status !== "loading" && session && (
            <Link
              href="/dashboard"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-secondary hover:bg-surface hover:text-text-primary"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border bg-background/95 md:hidden"
          >
            <div className="flex max-h-[min(70vh,calc(100dvh-4rem))] flex-col gap-1 overflow-y-auto px-4 py-4">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-text-primary hover:bg-surface"
                >
                  {l.label}
                </a>
              ))}
              {status !== "loading" && !session && (
                <>
                  <Link
                    href="/sign-in"
                    onClick={() => setMenuOpen(false)}
                    className="min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-text-primary hover:bg-surface"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setMenuOpen(false)}
                    className="mt-2 flex min-h-[44px] items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white hover:opacity-90"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
