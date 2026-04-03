"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
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

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card/80 backdrop-blur-xl">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" className="text-xl font-bold text-text-primary">
          Veya
        </Link>
      </div>
      <nav className="mt-6 space-y-1 px-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
              pathname === link.href
                ? "bg-accent/20 text-accent"
                : "text-text-secondary hover:bg-surface hover:text-text-primary"
            )}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-text-secondary hover:bg-surface hover:text-danger"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
