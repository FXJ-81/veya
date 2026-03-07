"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-bold text-text-primary">
          Veya
        </Link>
        <div className="flex items-center gap-8">
          <a href="#features" className="text-sm text-text-secondary hover:text-text-primary hidden sm:inline">
            Features
          </a>
          <a href="#pricing" className="text-sm text-text-secondary hover:text-text-primary hidden sm:inline">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-text-secondary hover:text-text-primary hidden sm:inline">
            FAQ
          </a>
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
              <Link
                href="/sign-in"
                className="text-sm text-text-secondary hover:text-text-primary"
              >
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
      </div>
    </motion.nav>
  );
}
