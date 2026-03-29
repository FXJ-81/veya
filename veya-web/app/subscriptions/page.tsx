"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { AddSubscriptionModal } from "@/components/subscriptions/AddSubscriptionModal";
import { EditSubscriptionModal } from "@/components/subscriptions/EditSubscriptionModal";
import {
  GmailScanResultsModal,
  type GmailScanRow,
} from "@/components/subscriptions/GmailScanResultsModal";
import { useSubscriptions, useSubscriptionMutations } from "@/hooks/useSubscriptions";
import { useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { nextRenewalSortKey } from "@/lib/subscriptionRenewal";

function SubscriptionsContent() {
  const { status } = useSession();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"name" | "price" | "nextRenewal">("nextRenewal");
  const { data: subs, isLoading, isFetching } = useSubscriptions();
  const { update, remove, create } = useSubscriptionMutations();
  const qc = useQueryClient();
  const isMutating = create.isPending || update.isPending || remove.isPending;
  const [gmailConnected, setGmailConnected] = useState(false);
  const [lastGmailScanAt, setLastGmailScanAt] = useState<string | null>(null);
  const [gmailScanning, setGmailScanning] = useState(false);
  const [gmailResultsOpen, setGmailResultsOpen] = useState(false);
  const [gmailCandidates, setGmailCandidates] = useState<GmailScanRow[]>([]);
  const [gmailImportBusy, setGmailImportBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings/gmail")
      .then((r) => r.json())
      .then((d) => {
        setGmailConnected(!!d.gmailConnected);
        setLastGmailScanAt(d.lastGmailScanAt ?? null);
      })
      .catch(() => {});
  }, []);

  const daysAgo = (iso: string | null) => {
    if (!iso) return null;
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d <= 0) return "today";
    if (d === 1) return "1 day ago";
    return `${d} days ago`;
  };

  const handleRescanGmail = async () => {
    if (!gmailConnected || gmailScanning) return;
    setGmailScanning(true);
    try {
      const res = await fetch("/api/subscriptions/gmail-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", mode: "manual" }),
      });
      const j = await res.json();
      if (!j.ok && j.error) {
        alert(j.error);
        return;
      }
      if (j.ok && Array.isArray(j.candidates)) {
        setGmailCandidates(j.candidates as GmailScanRow[]);
        setGmailResultsOpen(true);
      }
      const st = await fetch("/api/settings/gmail").then((r) => r.json());
      setLastGmailScanAt(st.lastGmailScanAt ?? null);
    } finally {
      setGmailScanning(false);
    }
  };

  const closeGmailResults = () => {
    if (gmailImportBusy) return;
    setGmailResultsOpen(false);
  };

  const importGmailSelection = async (messageIds: string[]) => {
    setGmailImportBusy(true);
    try {
      await fetch("/api/subscriptions/gmail-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", messageIds }),
      });
      setGmailResultsOpen(false);
      await qc.invalidateQueries({ queryKey: ["subscriptions"] });
      await qc.invalidateQueries({ queryKey: ["analytics"] });
      const st = await fetch("/api/settings/gmail").then((r) => r.json());
      setLastGmailScanAt(st.lastGmailScanAt ?? null);
    } finally {
      setGmailImportBusy(false);
    }
  };

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
        return nextRenewalSortKey(a) - nextRenewalSortKey(b);
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
    billingCycle: "monthly" | "yearly" | "weekly" | "custom";
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

  const handleSaveEdit = async (
    id: string,
    data: {
      name: string;
      category: string;
      price: number;
      billingCycle: "monthly" | "yearly" | "weekly" | "custom";
      startDate: string;
      nextRenewal: string;
      notes?: string;
    }
  ) => {
    await update.mutateAsync({
      id,
      ...data,
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              Subscriptions
            </h1>
            {(isMutating || (isFetching && subs != null)) && (
              <span className="text-xs font-medium text-text-tertiary animate-pulse">
                Updating…
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {gmailConnected && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                <button
                  type="button"
                  onClick={handleRescanGmail}
                  disabled={gmailScanning}
                  className="rounded-lg border border-border bg-background-secondary px-3 py-2 font-medium text-text-primary hover:border-accent disabled:opacity-50"
                >
                  {gmailScanning ? "Scanning…" : "🔍 Rescan Gmail"}
                </button>
                {lastGmailScanAt && (
                  <span>Last scanned: {daysAgo(lastGmailScanAt)}</span>
                )}
              </div>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              + Add subscription
            </button>
          </div>
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
          <div
            className={`space-y-4 transition-opacity duration-200 ${
              isMutating || (isFetching && subs != null) ? "opacity-80" : "opacity-100"
            }`}
          >
            {filtered.map((sub, i) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                index={i}
                onPause={handlePause}
                onCancel={() => remove.mutate(sub.id)}
                onEdit={setEditing}
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
      <EditSubscriptionModal
        open={!!editing}
        subscription={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveEdit}
      />

      <GmailScanResultsModal
        open={gmailResultsOpen}
        candidates={gmailCandidates}
        onClose={closeGmailResults}
        onSkip={closeGmailResults}
        onImport={importGmailSelection}
        busy={gmailImportBusy}
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
