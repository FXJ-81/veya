"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
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
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import type { Subscription } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { nextRenewalSortKey } from "@/lib/subscriptionRenewal";
import { executeScanImport } from "@/lib/executeScanImport";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import type { ScanImportPayload } from "@/types/scan";
import { categorySelectLabel } from "@/lib/categories";

type PlaidAccountRow = { id: string; bankName: string; lastSync: string | null };

function SubscriptionsContent() {
  const { status } = useSession();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"name" | "price" | "nextRenewal">("nextRenewal");
  const {
    data: subs,
    isLoading,
    isFetching,
    isError: subsError,
    refetch: refetchSubs,
  } = useSubscriptions();
  const { update, remove, create } = useSubscriptionMutations();
  const qc = useQueryClient();
  const isMutating = create.isPending || update.isPending || remove.isPending;
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccountRow[] | null>(null);
  const [gmailResultsOpen, setGmailResultsOpen] = useState(false);
  const [gmailCandidates, setGmailCandidates] = useState<GmailScanRow[]>([]);
  const [gmailImportBusy, setGmailImportBusy] = useState(false);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidBusy, setPlaidBusy] = useState(false);

  const refreshConnectionSettings = () =>
    fetch("/api/settings/gmail")
      .then((r) => r.json())
      .then((d) => {
        const rows = Array.isArray(d.plaidAccounts)
          ? (d.plaidAccounts as { id?: string; bankName?: string; lastSync?: string | null }[]).map(
              (a) => ({
                id: String(a.id ?? ""),
                bankName: typeof a.bankName === "string" ? a.bankName : "Bank",
                lastSync: typeof a.lastSync === "string" ? a.lastSync : null,
              }),
            )
          : [];
        setPlaidAccounts(rows.filter((a) => a.id));
      })
      .catch(() => {});

  useEffect(() => {
    refreshConnectionSettings();
  }, []);

  const closeGmailResults = () => {
    if (gmailImportBusy) return;
    setGmailResultsOpen(false);
  };

  const importScanSelection = async (payload: ScanImportPayload) => {
    setGmailImportBusy(true);
    try {
      const result = await executeScanImport(payload);
      await invalidateAfterSubscriptionChange(qc);
      await refreshConnectionSettings();
      return result;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import failed");
      throw e;
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

  const plaidLinked = (plaidAccounts?.length ?? 0) > 0;

  const resyncPlaid = async () => {
    if (!plaidLinked || plaidBusy) return;
    setPlaidBusy(true);
    try {
      const det = await fetch("/api/plaid/detect-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
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

  if (subsError) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-text-primary font-medium">Could not load subscriptions</p>
          <p className="mt-2 text-sm text-text-secondary">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void refetchSubs()}
            className="mt-6 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </AppShell>
    );
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
    <>
    <AppShell>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              Subscriptions
            </h1>
            {(isMutating || (isFetching && subs != null)) && (
              <span className="text-xs font-medium text-text-tertiary animate-pulse">
                Updating…
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {plaidAccounts === null ? (
              <span className="text-sm text-text-tertiary">…</span>
            ) : plaidLinked ? (
              <button
                type="button"
                onClick={resyncPlaid}
                disabled={plaidBusy}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background-secondary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent disabled:opacity-50"
              >
                <span className="min-w-0 truncate">
                  🟢{" "}
                  {plaidAccounts.length === 1
                    ? plaidAccounts[0].bankName
                    : `${plaidAccounts.length} banks`}{" "}
                  · Connected
                </span>
                <span className="shrink-0 text-text-tertiary" aria-hidden>
                  |
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {plaidBusy ? (
                    "Loading..."
                  ) : (
                    <>
                      <span aria-hidden>🔄</span>
                      Transactions
                    </>
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startPlaidLink}
                disabled={plaidBusy}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent disabled:opacity-50"
              >
                {plaidBusy ? "…" : "🏦 Connect bank account"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="hidden rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 md:inline-flex md:min-h-[44px] md:items-center"
            >
              + Add subscription
            </button>
          </div>
        </motion.div>

        <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-4">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[44px] w-full min-w-0 flex-1 rounded-xl border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder-text-tertiary focus:border-accent focus:outline-none"
          />
          <div className="flex min-w-0 flex-col gap-3 sm:flex-1 sm:flex-row sm:gap-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm text-text-primary focus:border-accent focus:outline-none sm:min-w-0 sm:flex-1"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categorySelectLabel(c)}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="min-h-[44px] w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm text-text-primary focus:border-accent focus:outline-none sm:min-w-0 sm:flex-1"
          >
            <option value="nextRenewal">Sort by renewal</option>
            <option value="name">Sort by name</option>
            <option value="price">Sort by price</option>
          </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="fixed bottom-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+12px)] right-4 z-[56] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-light text-white shadow-lg md:hidden"
          aria-label="Add subscription"
        >
          +
        </button>

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
    </AppShell>

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
        onAfterImportClose={() => setGmailResultsOpen(false)}
        busy={gmailImportBusy}
      />

      {plaidLinkToken && (
        <PlaidLinkHost
          token={plaidLinkToken}
          onSuccess={onPlaidLinkSuccess}
          onExit={() => setPlaidLinkToken(null)}
        />
      )}
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background px-4 py-8">
          <Skeleton className="mx-auto mb-6 h-10 max-w-md rounded-xl" />
          <Skeleton className="mx-auto h-48 max-w-3xl rounded-2xl" />
        </div>
      }
    >
      <SubscriptionsContent />
    </Suspense>
  );
}
