"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { type ReactNode, useState } from "react";
import { RefetchingBar } from "@/components/ui/RefetchingBar";
import { AccentPreferenceSync } from "@/components/settings/AccentPreferenceSync";

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            // Refetch when user returns to the tab so lists stay fresh
            refetchOnWindowFocus: true,
          },
        },
      })
  );
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        <AccentPreferenceSync />
        <RefetchingBar />
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
