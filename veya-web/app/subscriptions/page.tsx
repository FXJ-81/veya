"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
import { usePendingPlaidSubscriptions, useSubscriptions, useSubscriptionMutations } from "@/hooks/useSubscriptions";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import type { Subscription } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { nextRenewalSortKey } from "@/lib/subscriptionRenewal";
import { executeScanImport } from "@/lib/executeScanImport";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import type { ScanImportPayload } from "@/types/scan";
import { categorySelectLabel } from "@/lib/categories";
import type { PendingPlaidSubscriptionCandidate } from "@/types/plaidCandidate";
import { formatCurrency } from "@/lib/utils";

type PlaidAccountRow = { id: string; bankName: string; lastSync: string | null };

function bankCandidateSummary(candidate: PendingPlaidSubscriptionCandidate): string {
  return `${formatCurrency(candidate.price)}/mo • ${categorySelectLabel(candidate.category)}`;
}

function bankConnectionLabel(bankName: string): string {
  const clean = bankName.trim() || "Bank";
  const withBank = /\bbank\b/i.test(clean) ? clean : `${clean} Bank`;
  return `${withBank} connected`;
}

function SubscriptionsContent() {
  const { status } = useSession();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"name" | "price" | "nextRenewal">("nextRenewal");
  const {
    data: subscriptionData,
    isLoading,
    isFetching,
    isError: subsError,
    refetch: refetchSubs,
  } = useSubscriptions();
  const {
    data: pendingPlaidCandidates,
    isLoading: pendingPlaidLoading,
  } = usePendingPlaidSubscriptions();
  const { update, remove, create, resolvePendingPlaid } = useSubscriptionMutations();
  const qc = useQueryClient();
  const isMutating =
    create.isPending || update.isPending || remove.isPending || resolvePendingPlaid.isPending;
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccountRow[] | null>(null);
  const [gmailResultsOpen, setGmailResultsOpen] = useState(false);
  const [gmailCandidates, setGmailCandidates] = useState<GmailScanRow[]>([]);
  const [gmailImportBusy, setGmailImportBusy] = useState(false);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidBusy, setPlaidBusy] = useState(false);
  const subs = subscriptionData?.subscriptions ?? [];
  const plan = subscriptionData?.plan ?? "free";
  const isPremium = plan === "premium";
  const subscriptionLimit = subscriptionData?.subscriptionLimit ?? 10;
  const subscriptionRemaining = subscriptionData?.subscriptionRemaining ?? null;
  const atFreeSubscriptionLimit = !isPremium && subscriptionRemaining === 0;

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

  const persistPlaidDeclinedMerchants = useCallback(async (keys: string[]) => {
    if (!keys.length) return;
    await fetch("/api/settings/plaid-declined", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addKeys: keys }),
    });
  }, []);

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
  const pendingReviewCount = pendingPlaidCandidates?.length ?? 0;

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
        alert(dj.error ?? "Could not sync bank data");
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
    new Set(subs.map((s) => s.category))
  ).sort();

  const handlePause = (id: string) => {
    const sub = subs.find((s) => s.id === id);
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
    if (atFreeSubscriptionLimit) {
      throw new Error(
        `Free accounts can track up to ${subscriptionLimit} subscriptions. Upgrade to Premium for unlimited subscriptions.`,
      );
    }
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

  const handlePendingCandidateAction = async (
    ids: string[],
    action: "add" | "dismiss",
  ) => {
    await resolvePendingPlaid.mutateAsync({ ids, action });
    await refreshConnectionSettings();
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
            {(isMutating || (isFetching && subscriptionData != null)) && (
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
                  {plaidAccounts.length === 1
                    ? bankConnectionLabel(plaidAccounts[0].bankName)
                    : `${plaidAccounts.length} banks connected`}
                </span>
                <span className="shrink-0 text-text-tertiary" aria-hidden>
                  |
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {plaidBusy ? (
                    "Loading..."
                  ) : (
                    <>
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
                {plaidBusy ? "…" : "Connect bank account"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (atFreeSubscriptionLimit) {
                  alert(`Free accounts can track up to ${subscriptionLimit} subscriptions. Upgrade to Premium for unlimited subscriptions.`);
                  return;
                }
                setAddOpen(true);
              }}
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

        {!isPremium && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Free plan limits
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  You can track up to {subscriptionLimit} subscriptions on Free. Bank linking is included; Premium unlocks unlimited subscriptions, analytics, AI Coach, and notifications.
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-border bg-background-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                {subscriptionData?.subscriptionCount ?? subs.length}/{subscriptionLimit} used
              </span>
            </div>
          </section>
        )}

        {plaidLinked && (pendingPlaidLoading || pendingReviewCount > 0) && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Review bank-detected subscriptions
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {pendingPlaidLoading
                    ? "Checking your connected banks for subscriptions awaiting review..."
                    : pendingReviewCount === 1
                      ? "We found 1 subscription from your connected bank activity that is waiting for review."
                      : `We found ${pendingReviewCount} subscriptions from your connected bank activity that are waiting for review.`}
                </p>
              </div>
              {!pendingPlaidLoading && pendingReviewCount > 0 && (
                <span className="inline-flex w-fit items-center rounded-full border border-border bg-background-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                  {pendingReviewCount} to review
                </span>
              )}
            </div>

            {!pendingPlaidLoading && pendingReviewCount > 0 && (
              <div className="mt-4 space-y-3">
                {pendingPlaidCandidates!.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background-secondary/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-text-primary">{candidate.name}</p>
                        <span className="text-[11px] text-text-tertiary">Found from bank activity</span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {bankCandidateSummary(candidate)}
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        Last charged {new Date(candidate.lastCharged).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void handlePendingCandidateAction([candidate.id], "dismiss")}
                        disabled={resolvePendingPlaid.isPending}
                        className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-background-secondary disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePendingCandidateAction([candidate.id], "add")}
                        disabled={resolvePendingPlaid.isPending}
                        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Add subscription
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            if (atFreeSubscriptionLimit) {
              alert(`Free accounts can track up to ${subscriptionLimit} subscriptions. Upgrade to Premium for unlimited subscriptions.`);
              return;
            }
            setAddOpen(true);
          }}
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
              isMutating || (isFetching && subscriptionData != null) ? "opacity-80" : "opacity-100"
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
        persistPlaidDeclinedMerchants={persistPlaidDeclinedMerchants}
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
