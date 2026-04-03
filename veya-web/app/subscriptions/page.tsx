"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/layout/PageLayout";
import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { AddSubscriptionModal } from "@/components/subscriptions/AddSubscriptionModal";
import { EditSubscriptionModal } from "@/components/subscriptions/EditSubscriptionModal";
import {
  GmailScanResultsModal,
  type GmailScanRow,
} from "@/components/subscriptions/GmailScanResultsModal";
import { PlaidLinkHost } from "@/components/subscriptions/PlaidLinkHost";
import { useSubscriptions, useSubscriptionMutations } from "@/hooks/useSubscriptions";
import { useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { nextRenewalSortKey } from "@/lib/subscriptionRenewal";
import { executeScanImport } from "@/lib/executeScanImport";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import type { ScanImportPayload } from "@/types/scan";
import {
  SUBSCRIPTION_CATEGORIES,
  categoryIcon,
} from "@/lib/subscriptionCategories";

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
  const [plaidLinked, setPlaidLinked] = useState(false);
  const [lastPlaidSync, setLastPlaidSync] = useState<string | null>(null);
  const [lastGmailScanAt, setLastGmailScanAt] = useState<string | null>(null);
  const [gmailScanning, setGmailScanning] = useState(false);
  const [gmailResultsOpen, setGmailResultsOpen] = useState(false);
  const [gmailCandidates, setGmailCandidates] = useState<GmailScanRow[]>([]);
  const [gmailImportBusy, setGmailImportBusy] = useState(false);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidBusy, setPlaidBusy] = useState(false);

  const refreshConnectionSettings = () =>
    fetch("/api/settings/gmail")
      .then((r) => r.json())
      .then((d) => {
        setGmailConnected(!!d.gmailConnected);
        setPlaidLinked(!!d.plaidLinked);
        setLastPlaidSync(d.lastPlaidSync ?? null);
        setLastGmailScanAt(d.lastGmailScanAt ?? null);
      })
      .catch(() => {});

  useEffect(() => {
    refreshConnectionSettings();
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
        const mapped = (j.candidates as GmailScanRow[]).map((c) => ({
          ...c,
          rowId: c.messageId ?? c.rowId,
          source: "gmail" as const,
        }));
        setGmailCandidates(mapped);
        setGmailResultsOpen(true);
      }
      await refreshConnectionSettings();
    } finally {
      setGmailScanning(false);
    }
  };

  const closeGmailResults = () => {
    if (gmailImportBusy) return;
    setGmailResultsOpen(false);
  };

  const importScanSelection = async (payload: ScanImportPayload) => {
    setGmailImportBusy(true);
    try {
      await executeScanImport(payload);
      setGmailResultsOpen(false);
      await qc.invalidateQueries({ queryKey: ["subscriptions"] });
      await qc.invalidateQueries({ queryKey: ["analytics"] });
      await refreshConnectionSettings();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import failed");
    } finally {
      setGmailImportBusy(false);
    }
  };

  const startPlaidLink = async () => {
    setPlaidBusy(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.link_token) {
        throw new Error(j.error ?? "Could not start bank linking");
      }
      setPlaidLinkToken(j.link_token as string);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Plaid error");
    } finally {
      setPlaidBusy(false);
    }
  };

  const onPlaidLinkSuccess = async (publicToken: string) => {
    setPlaidLinkToken(null);
    setPlaidBusy(true);
    try {
      const ex = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const exj = await ex.json().catch(() => ({}));
      if (!ex.ok) throw new Error(exj.error ?? "Could not link bank");

      const det = await fetch("/api/plaid/detect-subscriptions", { method: "POST" });
      const dj = await det.json().catch(() => ({}));
      if (!det.ok || !dj.ok) throw new Error(dj.error ?? "Could not analyze transactions");

      const rows = mapPlaidDetectToScanRows(
        Array.isArray(dj.subscriptions) ? dj.subscriptions : []
      );
      setGmailCandidates(rows);
      setGmailResultsOpen(true);
      await refreshConnectionSettings();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Bank linking failed");
    } finally {
      setPlaidBusy(false);
    }
  };

  const resyncPlaid = async () => {
    if (!plaidLinked || plaidBusy) return;
    setPlaidBusy(true);
    try {
      const det = await fetch("/api/plaid/detect-subscriptions", { method: "POST" });
      const dj = await det.json().catch(() => ({}));
      if (!det.ok || !dj.ok) {
        alert(dj.error ?? "Resync failed");
        return;
      }
      const rows = mapPlaidDetectToScanRows(
        Array.isArray(dj.subscriptions) ? dj.subscriptions : []
      );
      setGmailCandidates(rows);
      setGmailResultsOpen(true);
      await refreshConnectionSettings();
    } finally {
      setPlaidBusy(false);
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

  const fromSubs = Array.from(new Set(subs?.map((s) => s.category) ?? []));
  const extras = fromSubs.filter(
    (c) => !(SUBSCRIPTION_CATEGORIES as readonly string[]).includes(c)
  );
  const categories = [...SUBSCRIPTION_CATEGORIES, ...extras.sort((a, b) => a.localeCompare(b))];

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
    <PageLayout>
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
            {plaidLinked ? (
              <button
                type="button"
                onClick={resyncPlaid}
                disabled={plaidBusy}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent disabled:opacity-50"
              >
                {plaidBusy ? "Syncing…" : "✅ Bank Connected · Resync"}
              </button>
            ) : (
              <button
                type="button"
                onClick={startPlaidLink}
                disabled={plaidBusy}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent disabled:opacity-50"
              >
                {plaidBusy ? "…" : "🏦 Connect Bank Account"}
              </button>
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
                {categoryIcon(c)} {c}
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
        onImport={importScanSelection}
        busy={gmailImportBusy}
      />

      {plaidLinkToken && (
        <PlaidLinkHost
          token={plaidLinkToken}
          onSuccess={onPlaidLinkSuccess}
          onExit={() => setPlaidLinkToken(null)}
        />
      )}
    </PageLayout>
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
