"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { AddSubscriptionModal } from "@/components/subscriptions/AddSubscriptionModal";
import { useSubscriptions, useSubscriptionMutations } from "@/hooks/useSubscriptions";
import type { Subscription, DiscoverSuggestion } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";

function SubscriptionsContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"name" | "price" | "nextRenewal">("nextRenewal");
  const [discoverOpen, setDiscoverOpen] = useState(true);
  const [pastedText, setPastedText] = useState("");
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [suggestions, setSuggestions] = useState<DiscoverSuggestion[]>([]);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [inboxSuggestions, setInboxSuggestions] = useState<DiscoverSuggestion[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const { data: subs, isLoading } = useSubscriptions();
  const { update, remove, create } = useSubscriptionMutations();

  const runDiscover = async () => {
    setDiscoverError("");
    if (!pastedText.trim()) {
      setDiscoverError("Paste some receipt or subscription email text first.");
      return;
    }
    setDiscoverLoading(true);
    try {
      const res = await fetch("/api/subscriptions/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDiscoverError(data.error ?? "Failed to parse. Try pasting more of the email.");
        setSuggestions([]);
        return;
      }
      setSuggestions(data.suggestions ?? []);
      if (!(data.suggestions?.length)) {
        setDiscoverError("No subscriptions detected. Try pasting a full receipt or email.");
      }
    } catch {
      setDiscoverError("Something went wrong. Try again.");
      setSuggestions([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const addSuggestion = async (s: DiscoverSuggestion) => {
    await create.mutateAsync({
      name: s.name,
      category: s.category,
      price: s.price,
      billingCycle: s.billingCycle,
      startDate: s.startDate,
      nextRenewal: s.nextRenewal,
      status: "active",
      isShared: false,
    });
    setSuggestions((prev) => prev.filter((x) => x.name !== s.name || x.price !== s.price));
  };

  const addInboxSuggestion = async (s: DiscoverSuggestion) => {
    await create.mutateAsync({
      name: s.name,
      category: s.category,
      price: s.price,
      billingCycle: s.billingCycle,
      startDate: s.startDate,
      nextRenewal: s.nextRenewal,
      status: "active",
      isShared: false,
    });
    setInboxSuggestions((prev) => prev.filter((x) => x.name !== s.name || x.price !== s.price));
  };

  const runScanInbox = async () => {
    setScanLoading(true);
    try {
      const res = await fetch("/api/subscriptions/scan-email");
      const data = await res.json().catch(() => ({}));
      setInboxSuggestions(data.suggestions ?? []);
    } catch {
      setInboxSuggestions([]);
    } finally {
      setScanLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/subscriptions/email-status")
      .then((r) => r.json())
      .then((d) => setGmailConnected(!!d.connected))
      .catch(() => setGmailConnected(false));
  }, [status]);

  useEffect(() => {
    if (gmailConnected !== true || searchParams.get("scan") !== "1") return;
    setScanLoading(true);
    fetch("/api/subscriptions/scan-email")
      .then((r) => r.json())
      .then((d) => setInboxSuggestions(d.suggestions ?? []))
      .catch(() => setInboxSuggestions([]))
      .finally(() => setScanLoading(false));
    router.replace("/subscriptions", { scroll: false });
  }, [gmailConnected, searchParams, router]);

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
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
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

        {/* Auto-discover: from email + placeholders for Gmail / apps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-border bg-card p-6 mb-8"
        >
          <button
            type="button"
            onClick={() => setDiscoverOpen(!discoverOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-semibold text-text-primary">
              Discover subscriptions
            </h2>
            <span className="text-text-tertiary text-sm">
              {discoverOpen ? "▼" : "▶"}
            </span>
          </button>
          {discoverOpen && (
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm text-text-secondary mb-2">
                  From email: paste a receipt or subscription email below to detect services and price.
                </p>
                <textarea
                  placeholder="Paste email or receipt text (e.g. from Netflix, Spotify, your bank)..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none resize-none"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={runDiscover}
                    disabled={discoverLoading}
                    className="rounded-xl bg-accent/90 px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-60"
                  >
                    {discoverLoading ? "Finding…" : "Find subscriptions"}
                  </button>
                  {discoverError && (
                    <span className="text-danger text-sm">{discoverError}</span>
                  )}
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <span
                        key={`${s.name}-${s.price}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-background-secondary border border-border px-3 py-2 text-sm text-text-primary"
                      >
                        <span>{s.name} — ${s.price}/{s.billingCycle === "yearly" ? "yr" : "mo"}</span>
                        <button
                          type="button"
                          onClick={() => addSuggestion(s)}
                          className="text-accent hover:underline font-medium"
                        >
                          Add
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {gmailConnected === false && (
                    <a
                      href="/api/auth/connect-gmail"
                      className="rounded-xl bg-accent/90 px-4 py-2 text-sm font-medium text-white hover:bg-accent"
                    >
                      Connect Gmail
                    </a>
                  )}
                  {gmailConnected === true && (
                    <>
                      <span className="text-text-secondary text-sm">Gmail connected.</span>
                      <button
                        type="button"
                        onClick={runScanInbox}
                        disabled={scanLoading}
                        className="rounded-xl bg-accent/90 px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-60"
                      >
                        {scanLoading ? "Scanning…" : "Scan inbox now"}
                      </button>
                    </>
                  )}
                  {gmailConnected === null && (
                    <span className="text-text-tertiary text-sm">Checking…</span>
                  )}
                  <span className="text-text-secondary text-sm">
                    {gmailConnected === true
                      ? "We scan for subscription and receipt emails so you can add them with one click."
                      : "Connect Gmail to automatically find subscriptions from your inbox when you sign in."}
                  </span>
                </div>
                {inboxSuggestions.length > 0 && (
                  <div>
                    <p className="text-sm text-text-secondary mb-2">From your inbox:</p>
                    <div className="flex flex-wrap gap-2">
                      {inboxSuggestions.map((s) => (
                        <span
                          key={`inbox-${s.name}-${s.price}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-background-secondary border border-border px-3 py-2 text-sm text-text-primary"
                        >
                          <span>{s.name} — ${s.price}/{s.billingCycle === "yearly" ? "yr" : "mo"}</span>
                          <button
                            type="button"
                            onClick={() => addInboxSuggestion(s)}
                            className="text-accent hover:underline font-medium"
                          >
                            Add
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-text-secondary pt-2">
                  <div>
                    <span className="rounded bg-background-secondary px-2 py-0.5 text-xs text-text-tertiary">Mobile</span>
                    <span className="block mt-1">Use the Veya mobile app to detect subscription apps on your phone.</span>
                  </div>
                  <div>
                    <span className="rounded bg-background-secondary px-2 py-0.5 text-xs text-text-tertiary">Desktop</span>
                    <span className="block mt-1">Desktop companion app to list apps on your computer — coming soon.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
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

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    }>
      <SubscriptionsContent />
    </Suspense>
  );
}
