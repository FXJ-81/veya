"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { AddSubscriptionModal } from "@/components/subscriptions/AddSubscriptionModal";
import { useSubscriptions, useSubscriptionMutations } from "@/hooks/useSubscriptions";
import type { Subscription } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SubscriptionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"name" | "price" | "nextRenewal">("nextRenewal");
  const { data: subs, isLoading } = useSubscriptions();
  const { update, remove, create } = useSubscriptionMutations();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  const filtered =
    subs
      ?.filter((s) => {
        const matchSearch =
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.category.toLowerCase().includes(search.toLowerCase());
        const matchCat = !category || s.category === category;
        return matchSearch && matchCat;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "price") return b.price - a.price;
        return (
          new Date(a.nextRenewal).getTime() - new Date(b.nextRenewal).getTime()
        );
      }) ?? [];

  const categories = Array.from(
    new Set(subs?.map((s) => s.category) ?? [])
  ).sort();

  const handlePause = (id: string) => {
    const sub = subs?.find((s) => s.id === id);
    if (sub) update.mutate({ id, status: sub.status === "active" ? "paused" : "active" });
  };

  const handleAdd = async (data: {
    name: string;
    category: string;
    price: number;
    billingCycle: "monthly" | "yearly" | "weekly";
    startDate: string;
    nextRenewal: string;
    notes?: string;
  }) => {
    await create.mutateAsync({
      ...data,
      status: "active",
      isShared: false,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-56 pr-6 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <h1 className="text-2xl font-bold text-text-primary">
            Subscriptions
          </h1>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add subscription
          </button>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="nextRenewal">Sort by renewal</option>
            <option value="name">Sort by name</option>
            <option value="price">Sort by price</option>
          </select>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-12 text-center text-text-secondary"
          >
            <p className="mb-4">No subscriptions yet.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-xl bg-accent px-6 py-3 text-white font-semibold hover:opacity-90"
            >
              Add your first subscription
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filtered.map((sub, i) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                index={i}
                onPause={handlePause}
                onCancel={() => remove.mutate(sub.id)}
              />
            ))}
          </div>
        )}
      </main>

      <AddSubscriptionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />
    </div>
  );
}
