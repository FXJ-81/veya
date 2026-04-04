"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";

async function fetchTip(): Promise<{ tip: string }> {
  const res = await fetch("/api/ai/daily-tip");
  return res.json();
}

export function AITipCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-tip"],
    queryFn: fetchTip,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-accent-2/10 backdrop-blur-xl p-6 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/5 to-transparent pointer-events-none" />
      <div className="relative">
        <p className="text-sm font-medium text-accent mb-2">Veya AI Tip</p>
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <p className="text-text-primary text-sm leading-relaxed">
            {data?.tip ?? "Connect your subscriptions to get personalized tips."}
          </p>
        )}
        <Link
          href="/coach"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/30"
        >
          Chat with Veya AI
        </Link>
      </div>
    </motion.div>
  );
}
