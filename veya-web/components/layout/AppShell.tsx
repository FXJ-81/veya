"use client";

import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export type AppShellVariant = "default" | "coach";

/**
 * Authenticated shell: floating sidebar (md+), mobile bottom nav only (<md).
 */
export function AppShell({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: AppShellVariant;
}) {
  const isCoach = variant === "coach";

  return (
    <div className="flex h-[100dvh] min-w-[320px] flex-col bg-background overflow-hidden">
      <Sidebar />
      <BottomNav />

      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 max-w-[100vw] flex-1 flex-col",
          isCoach && "min-h-[100dvh] md:h-[100dvh] md:max-h-screen md:min-h-0",
        )}
      >
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain",
            isCoach && "min-h-0",
            /* Mobile: 24px horizontal padding; clear bottom tab bar */
            "max-md:px-6 max-md:pt-[max(1.5rem,env(safe-area-inset-top,0px))]",
            "max-md:pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+1.5rem)]",
            isCoach && "max-md:overflow-hidden",
            /* Tablet + desktop: padding; offset past floating sidebar rail */
            "md:px-6 md:py-6 md:pl-[calc(var(--app-sidebar-width)+1rem)] md:pr-6",
            "xl:pr-8",
            isCoach && "md:overflow-hidden",
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full min-w-0 max-w-[var(--app-workspace-max)] flex-1 flex-col break-words",
              isCoach && "min-h-0",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
