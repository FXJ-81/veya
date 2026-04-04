"use client";

import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export type AppShellVariant = "default" | "coach";

/**
 * Authenticated shell: desktop sidebar (lg+), tablet hamburger (md–lg), mobile bottom nav (<md).
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
    <div className="min-h-screen min-w-[320px] bg-background">
      <Sidebar />
      <BottomNav />

      <div
        className={cn(
          "w-full min-w-0 max-w-[100vw]",
          isCoach &&
            "flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:max-h-screen lg:min-h-0",
        )}
      >
        <main
          className={cn(
            "flex min-w-0 flex-col",
            isCoach && "min-h-0 flex-1",
            /* Mobile: no top bar; clear bottom tab bar */
            "max-md:pl-4 max-md:pr-4 max-md:pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
            "max-md:pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]",
            /* Tablet */
            "md:px-5 md:pb-6 md:pt-16",
            /* Desktop */
            "lg:px-0 lg:pb-6 lg:pl-[var(--app-sidebar-width)] lg:pr-6 lg:pt-6 xl:pr-8",
            isCoach && "lg:overflow-hidden",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full min-w-0 max-w-[var(--app-workspace-max)] break-words",
              isCoach && "flex min-h-0 flex-1 flex-col",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
