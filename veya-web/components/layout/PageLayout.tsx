"use client";

import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  /**
   * When true, skips the max-w-7xl centered container.
   * Use for full-viewport-height pages like the AI Coach.
   */
  fullHeight?: boolean;
}

/**
 * Shell used by every authenticated page.
 * Sidebar is fixed at w-64 (256px). Content starts at pl-64 with generous
 * horizontal and vertical padding, capped at max-w-7xl and centered.
 */
export function PageLayout({ children, fullHeight = false }: PageLayoutProps) {
  if (fullHeight) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="pl-64 pr-10 py-10 flex flex-col h-screen">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="min-h-screen pl-64">
        <div className="mx-auto max-w-7xl px-10 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
