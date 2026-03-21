"use client";

import { useIsFetching } from "@tanstack/react-query";

/**
 * Subtle indicator when subscriptions or analytics refetch in the background
 * (e.g. after a mutation). Hidden on first load (no cached data yet).
 */
export function RefetchingBar() {
  const fetching = useIsFetching({
    predicate: (query) => {
      const root = query.queryKey[0];
      if (root !== "subscriptions" && root !== "analytics") return false;
      return query.state.data !== undefined && query.state.fetchStatus === "fetching";
    },
  });

  if (fetching === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 right-0 z-[200] flex justify-center pt-2"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs font-medium text-text-secondary shadow-lg backdrop-blur-sm">
        Refreshing…
      </div>
    </div>
  );
}
