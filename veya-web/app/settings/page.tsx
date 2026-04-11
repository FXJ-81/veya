"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type FormEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  GmailScanResultsModal,
  type GmailScanRow,
} from "@/components/subscriptions/GmailScanResultsModal";
import { PlaidLinkHost } from "@/components/subscriptions/PlaidLinkHost";
import { PlaidSecurityBadges } from "@/components/settings/PlaidSecurityBadges";
import { executeScanImport } from "@/lib/executeScanImport";
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import type { ScanImportPayload } from "@/types/scan";
import { cn } from "@/lib/utils";
import type { NotificationPrefKey } from "@/lib/notificationPrefs";

type PlaidAccountRow = {
  id: string;
  bankName: string;
  lastSync: string | null;
};

function strengthScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

function browserSessionLabel(): string {
  if (typeof navigator === "undefined") return "this device";
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  let os = "this device";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  return `${browser} on ${os}`;
}

const NOTIFICATION_SETTING_ROWS: {
  key: NotificationPrefKey;
  label: string;
  description: string;
}[] = [
  {
    key: "renewalReminders",
    label: "Renewal reminders",
    description: "Get notified 7 days before a subscription renews",
  },
  {
    key: "budgetAlerts",
    label: "Budget alerts",
    description: "Alert when you exceed a budget limit",
  },
  {
    key: "newSubscriptionDetected",
    label: "New subscription detected",
    description: "When bank scan finds a new subscription",
  },
  {
    key: "weeklySpendingSummary",
    label: "Weekly spending summary",
    description: "Every Monday: your weekly subscription recap",
  },
  {
    key: "priceIncreaseAlerts",
    label: "Price increase alerts",
    description: "When a subscription price changes",
  },
];

function scanLabel(iso: string | null): string {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) > 1 ? "s" : ""} ago`;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<"free" | "premium">("free");

  // Bank accounts state — null = still loading, [] = loaded (empty), [...] = loaded
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccountRow[] | null>(null);
  const [bankLoadError, setBankLoadError] = useState(false);

  // Per-operation busy states
  const [connectingBank, setConnectingBank] = useState(false);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Inline errors (no more alert())
  const [bankError, setBankError] = useState<string | null>(null);

  // Plaid Link
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);

  // Scan results after connecting / resyncing
  const [gmailResultsOpen, setGmailResultsOpen] = useState(false);
  const [gmailCandidates, setGmailCandidates] = useState<GmailScanRow[]>([]);
  const [gmailImportBusy, setGmailImportBusy] = useState(false);

  // Disconnect confirmation
  const [confirmDisconnect, setConfirmDisconnect] = useState<PlaidAccountRow | null>(null);

  // Account deletion
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Security
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState("this device");
  const [signOutAllBusy, setSignOutAllBusy] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<Record<NotificationPrefKey, boolean> | null>(null);
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(true);
  const notifPrefsRef = useRef(notifPrefs);
  notifPrefsRef.current = notifPrefs;

  const strength = useMemo(() => strengthScore(newPw), [newPw]);

  useEffect(() => {
    setSessionLabel(browserSessionLabel());
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  // ── load bank accounts ──────────────────────────────────────────────────────
  const loadBankAccounts = useCallback(async () => {
    setBankLoadError(false);
    setBankError(null);
    try {
      const res = await fetch("/api/plaid/banks");
      const d = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        const detail = typeof d.detail === "string" ? d.detail : typeof d.error === "string" ? d.error : "";
        const msg = res.status === 401
          ? "Session expired — please refresh the page."
          : detail || `Server error (${res.status})`;
        console.error("[loadBankAccounts] non-ok response", res.status, d);
        setBankLoadError(true);
        setBankError(msg);
        setPlaidAccounts([]);
        return;
      }
      const rows = Array.isArray(d.accounts)
        ? (d.accounts as { id?: unknown; bankName?: unknown; lastSync?: unknown }[])
            .map((a) => ({
              id: String(a.id ?? ""),
              bankName: typeof a.bankName === "string" && a.bankName ? a.bankName : "Bank",
              lastSync: typeof a.lastSync === "string" ? a.lastSync : null,
            }))
            .filter((a) => a.id)
        : [];
      setPlaidAccounts(rows);
    } catch (e) {
      console.error("[loadBankAccounts] network error:", e);
      setPlaidAccounts([]);
      setBankLoadError(true);
      setBankError("Could not reach the server. Check your connection.");
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/billing")
        .then((r) => r.json())
        .then((d) => setPlan(d.plan ?? "free"))
        .catch(() => {});
      void loadBankAccounts();
      fetch("/api/user/password")
        .then((r) => r.json())
        .then((d: { hasPassword?: boolean }) => setHasPassword(!!d.hasPassword))
        .catch(() => setHasPassword(false));
    }
  }, [status, loadBankAccounts]);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") {
        setNotifPrefs(null);
        setNotifPrefsLoading(false);
      }
      return;
    }
    setNotifPrefsLoading(true);
    fetch("/api/settings/notifications")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { prefs: Record<NotificationPrefKey, boolean> }) => {
        setNotifPrefs(d.prefs);
      })
      .catch(() => setNotifPrefs(null))
      .finally(() => setNotifPrefsLoading(false));
  }, [status]);

  const toggleNotifPref = useCallback(async (key: NotificationPrefKey) => {
    const snap = notifPrefsRef.current;
    if (!snap) return;
    const nextVal = !snap[key];
    setNotifPrefs({ ...snap, [key]: nextVal });
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: nextVal }),
      });
      if (!res.ok) throw new Error("save failed");
      const d = (await res.json()) as { prefs: Record<NotificationPrefKey, boolean> };
      setNotifPrefs(d.prefs);
    } catch {
      setNotifPrefs(snap);
    }
  }, []);

  // ── Plaid connect ───────────────────────────────────────────────────────────
  const startPlaidLink = async () => {
    setBankError(null);
    setConnectingBank(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.link_token) throw new Error(j.error ?? "Could not start bank linking");
      setPlaidLinkToken(j.link_token as string);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Failed to open bank connection");
    } finally {
      setConnectingBank(false);
    }
  };

  const onPlaidLinkSuccess = async (publicToken: string) => {
    setPlaidLinkToken(null);
    setBankError(null);
    setConnectingBank(true);
    try {
      const ex = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const exj = await ex.json().catch(() => ({}));
      if (!ex.ok) throw new Error(exj.error ?? "Could not link bank");

      // Refresh accounts first so the new bank shows immediately
      await loadBankAccounts();

      // Then detect subscriptions from the new bank
      try {
        const det = await fetch("/api/plaid/detect-subscriptions", { method: "POST" });
        const dj = await det.json().catch(() => ({}));
        if (det.ok && dj.ok) {
          const rows = mapPlaidDetectToScanRows(
            Array.isArray(dj.subscriptions) ? dj.subscriptions : [],
          );
          if (rows.length > 0) {
            setGmailCandidates(rows);
            setGmailResultsOpen(true);
          }
          // Refresh again to get updated lastSync time
          await loadBankAccounts();
        }
      } catch {
        // Subscription detection failing shouldn't break the connect flow
      }
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Bank linking failed");
    } finally {
      setConnectingBank(false);
    }
  };

  // ── Resync ──────────────────────────────────────────────────────────────────
  const resyncBank = async (acc: PlaidAccountRow) => {
    setBankError(null);
    setResyncingId(acc.id);
    try {
      const det = await fetch("/api/plaid/detect-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidAccountId: acc.id }),
      });
      const dj = await det.json().catch(() => ({}));
      if (!det.ok || !dj.ok) throw new Error(dj.error ?? "Resync failed");
      const rows = mapPlaidDetectToScanRows(
        Array.isArray(dj.subscriptions) ? dj.subscriptions : [],
      );
      if (rows.length > 0) {
        setGmailCandidates(rows);
        setGmailResultsOpen(true);
      }
      await loadBankAccounts();
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Resync failed");
    } finally {
      setResyncingId(null);
    }
  };

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const confirmAndDisconnect = (acc: PlaidAccountRow) => {
    setBankError(null);
    setConfirmDisconnect(acc);
  };

  const doDisconnect = async () => {
    if (!confirmDisconnect) return;
    const acc = confirmDisconnect;
    setConfirmDisconnect(null);
    setDisconnectingId(acc.id);
    setBankError(null);
    try {
      const res = await fetch(`/api/plaid/accounts/${encodeURIComponent(acc.id)}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Disconnect failed");
      await loadBankAccounts();
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Failed to disconnect bank");
    } finally {
      setDisconnectingId(null);
    }
  };

  // ── Scan import ─────────────────────────────────────────────────────────────
  const importScanSelection = async (payload: ScanImportPayload) => {
    setGmailImportBusy(true);
    try {
      const result = await executeScanImport(payload);
      await invalidateAfterSubscriptionChange(qc);
      await loadBankAccounts();
      return result;
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Import failed");
      throw e;
    } finally {
      setGmailImportBusy(false);
    }
  };

  // ── Security ────────────────────────────────────────────────────────────────
  const submitPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (newPw.length < 8) { setPwErr("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwErr("New password and confirmation don't match."); return; }
    setPwBusy(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setPwErr((j as { error?: string }).error ?? "Could not update password."); return; }
      setPwMsg("Password updated successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } finally {
      setPwBusy(false);
    }
  };

  const signOutAllDevices = async () => {
    setSignOutAllBusy(true);
    try {
      await fetch("/api/user/sessions", { method: "DELETE" });
      await signOut({ callbackUrl: "/sign-in" });
    } finally {
      setSignOutAllBusy(false);
    }
  };

  const handleUpgrade = async () => {
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upgrade" }),
    });
    const json = await res.json();
    if (json.plan) setPlan(json.plan);
  };

  const runDeleteAccount = async () => {
    setDeleteToast(null);
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setDeleteToast(e instanceof Error ? e.message : "Failed to delete account");
      setDeleteBusy(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  const anyBankBusy = connectingBank || resyncingId !== null || disconnectingId !== null;

  return (
    <>
      <AppShell>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 text-2xl font-bold text-text-primary sm:mb-8"
        >
          Settings
        </motion.h1>

        <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6">

          {/* ── Profile ── */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Profile</h2>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
                {(session?.user?.name ?? session?.user?.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-text-primary">
                  {session?.user?.name ?? "No name"}
                </p>
                <p className="text-sm text-text-secondary">{session?.user?.email}</p>
              </div>
            </div>
          </Card>

          {/* ── Plan ── */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Plan</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Badge variant={plan === "premium" ? "accent" : "default"}>
                {plan === "premium" ? "Premium" : "Free"}
              </Badge>
              {plan === "free" && (
                <Button className="w-full sm:w-auto" onClick={handleUpgrade}>
                  Upgrade to Premium
                </Button>
              )}
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              {plan === "premium"
                ? "You have full access to AI coach, full analytics, and more."
                : "Upgrade for unlimited subscriptions, full analytics, and AI coach."}
            </p>
          </Card>

          {/* ── Bank Accounts ── */}
          <Card>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Bank Accounts</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Connect your banks so Veya can detect subscriptions from your transactions.
                </p>
              </div>
              {plaidAccounts !== null && plaidAccounts.length > 0 && (
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={startPlaidLink}
                  disabled={anyBankBusy}
                >
                  {connectingBank ? "Opening…" : "+ Add bank"}
                </Button>
              )}
            </div>

            {/* Error banner */}
            {bankError && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
                <span className="mt-0.5 text-danger">⚠️</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-danger">Something went wrong</p>
                  <p className="text-sm text-text-secondary">{bankError}</p>
                </div>
                <button
                  onClick={() => setBankError(null)}
                  className="shrink-0 text-text-tertiary hover:text-text-primary"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Loading skeleton */}
            {plaidAccounts === null ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl border border-border bg-background-secondary/40"
                  />
                ))}
              </div>
            ) : bankLoadError ? (
              <div className="rounded-xl border border-border bg-background-secondary/30 p-4 text-center">
                <p className="mb-1 text-sm font-medium text-text-primary">Could not load bank accounts</p>
                {bankError && (
                  <p className="mb-3 text-xs text-text-tertiary">{bankError}</p>
                )}
                <Button variant="secondary" onClick={() => void loadBankAccounts()}>
                  Retry
                </Button>
              </div>
            ) : plaidAccounts.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-background-secondary/20 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-3xl">
                  🏦
                </div>
                <div>
                  <p className="font-medium text-text-primary">No banks connected</p>
                  <p className="mt-1 max-w-xs text-sm text-text-secondary">
                    Connect a bank account and Veya will automatically find your subscriptions.
                  </p>
                </div>
                <Button onClick={startPlaidLink} disabled={connectingBank}>
                  {connectingBank ? "Opening…" : "Connect a bank account"}
                </Button>
                <PlaidSecurityBadges className="mt-2 max-w-lg" />
              </div>
            ) : (
              /* Accounts list */
              <ul className="space-y-3">
                {plaidAccounts.map((acc) => {
                  const isSyncing = resyncingId === acc.id;
                  const isDisconnecting = disconnectingId === acc.id;
                  const busy = isSyncing || isDisconnecting;

                  return (
                    <li
                      key={acc.id}
                      className={`rounded-xl border bg-background-secondary/20 p-4 transition-opacity ${
                        isDisconnecting ? "opacity-50" : "border-border"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Bank info */}
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-xl">
                            🏦
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-text-primary">{acc.bankName}</span>
                              <Badge variant="success">Connected</Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-text-tertiary">
                              Last synced: {scanLabel(acc.lastSync)}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 sm:shrink-0">
                          <Button
                            variant="secondary"
                            className="flex-1 sm:flex-none"
                            onClick={() => void resyncBank(acc)}
                            disabled={anyBankBusy}
                          >
                            {isSyncing ? (
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Syncing…
                              </span>
                            ) : (
                              "Resync"
                            )}
                          </Button>
                          <Button
                            variant="danger"
                            className="flex-1 sm:flex-none"
                            onClick={() => confirmAndDisconnect(acc)}
                            disabled={anyBankBusy || busy}
                          >
                            {isDisconnecting ? "Removing…" : "Disconnect"}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}

                {/* Add another bank */}
                <li>
                  <button
                    type="button"
                    onClick={startPlaidLink}
                    disabled={anyBankBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {connectingBank ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Opening Plaid…
                      </>
                    ) : (
                      <>+ Connect another bank</>
                    )}
                  </button>
                </li>
              </ul>
            )}

            {!bankLoadError && <PlaidSecurityBadges className="mt-4" />}
          </Card>

          {/* ── Notifications ── */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Notifications</h2>
            {notifPrefsLoading ? (
              <p className="text-sm text-text-tertiary">Loading…</p>
            ) : !notifPrefs ? (
              <p className="text-sm text-text-secondary">Could not load notification settings.</p>
            ) : (
              <ul className="divide-y divide-border">
                {NOTIFICATION_SETTING_ROWS.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-medium text-text-primary">{row.label}</p>
                      <p className="mt-0.5 text-sm text-text-tertiary">{row.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifPrefs[row.key]}
                      onClick={() => void toggleNotifPref(row.key)}
                      className={cn(
                        "relative inline-flex h-8 w-[3.25rem] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background",
                        notifPrefs[row.key] ? "bg-accent" : "bg-border",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none mt-0.5 inline-block h-6 w-6 rounded-full bg-white shadow transition duration-200 ease-out",
                          notifPrefs[row.key] ? "translate-x-[1.35rem]" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Security ── */}
          <Card>
            <h2 className="mb-6 text-lg font-semibold text-text-primary">Security</h2>
            <div className="space-y-10">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-text-primary">Change password</h3>
                {hasPassword === false ? (
                  <p className="max-w-md text-sm text-text-secondary">
                    You sign in with Google. Password change isn't available for this account.
                  </p>
                ) : hasPassword === null ? (
                  <p className="text-sm text-text-tertiary">Loading…</p>
                ) : (
                  <form
                    onSubmit={submitPasswordChange}
                    className="max-w-md space-y-3 rounded-xl border border-border bg-background-secondary/30 p-4"
                  >
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-tertiary">
                        Current password
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-tertiary">
                        New password
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                      <div className="mt-2 flex gap-1" aria-hidden>
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${i < strength ? "bg-accent" : "bg-border"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-tertiary">
                        Confirm new password
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                    {pwErr && <p className="text-sm text-danger">{pwErr}</p>}
                    {pwMsg && <p className="text-sm text-success">{pwMsg}</p>}
                    <Button type="submit" className="w-full sm:w-auto" isLoading={pwBusy}>
                      Update password
                    </Button>
                    <p className="pt-1">
                      <Link href="/forgot-password" className="text-sm text-accent hover:underline">
                        Forgot password?
                      </Link>
                    </p>
                  </form>
                )}
              </div>

              <div className="border-t border-border pt-8">
                <h3 className="mb-3 text-sm font-semibold text-text-primary">Active sessions</h3>
                <div className="flex max-w-md flex-col gap-3 rounded-xl border border-border bg-background-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">Current session — {sessionLabel}</p>
                    <Badge variant="success" className="mt-2">This device</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => void signOutAllDevices()}
                    isLoading={signOutAllBusy}
                  >
                    Sign out all devices
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* ── Danger zone ── */}
          <Card className="border-danger/30">
            <h2 className="mb-2 text-lg font-semibold text-danger">Danger zone</h2>
            <p className="mb-4 text-sm text-text-secondary">
              Delete your account and all data. This cannot be undone.
            </p>
            <Button
              className="w-full sm:w-auto"
              variant="danger"
              onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteToast(null); }}
            >
              Delete account
            </Button>
          </Card>

          <div className="pt-4">
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </AppShell>

      {/* ── Delete account toast ── */}
      {deleteToast && (
        <div className="fixed right-4 top-4 z-[60] max-w-sm rounded-xl border border-danger/30 bg-card px-4 py-3 text-sm text-text-primary shadow-lg">
          <div className="mb-1 font-medium text-danger">Error</div>
          <div className="text-text-secondary">{deleteToast}</div>
        </div>
      )}

      {/* ── Delete account modal ── */}
      <Modal
        open={deleteOpen}
        onClose={() => { if (!deleteBusy) setDeleteOpen(false); }}
        title="Delete your account?"
        className="max-w-md"
      >
        <p className="mb-4 text-sm text-text-secondary">
          This will permanently delete your account and all data including subscriptions, chat
          history, and settings. This cannot be undone.
        </p>
        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-tertiary">
            Type <span className="font-semibold text-text-primary">DELETE</span> to confirm
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            disabled={deleteBusy}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={runDeleteAccount}
            disabled={deleteBusy || deleteConfirm !== "DELETE"}
            className="min-h-[44px] w-full rounded-xl px-4 py-2 text-sm font-medium text-background transition-colors disabled:opacity-50 sm:min-h-0 sm:w-auto"
            style={{ background: "#f87171" }}
          >
            {deleteBusy ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </Modal>

      {/* ── Disconnect confirmation modal ── */}
      <Modal
        open={!!confirmDisconnect}
        onClose={() => setConfirmDisconnect(null)}
        title="Disconnect bank?"
        className="max-w-sm"
      >
        <p className="mb-5 text-sm text-text-secondary">
          This will remove{" "}
          <span className="font-semibold text-text-primary">
            {confirmDisconnect?.bankName ?? "this bank"}
          </span>{" "}
          from Veya. Your subscription data will not be deleted, but future syncs will stop.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setConfirmDisconnect(null)}>
            Cancel
          </Button>
          <Button variant="danger" className="w-full sm:w-auto" onClick={() => void doDisconnect()}>
            Disconnect
          </Button>
        </div>
      </Modal>

      {/* ── Scan results modal ── */}
      <GmailScanResultsModal
        open={gmailResultsOpen}
        candidates={gmailCandidates}
        onClose={() => { if (!gmailImportBusy) setGmailResultsOpen(false); }}
        onSkip={() => setGmailResultsOpen(false)}
        onImport={importScanSelection}
        onAfterImportClose={() => setGmailResultsOpen(false)}
        busy={gmailImportBusy}
      />

      {/* ── Plaid Link host (invisible trigger) ── */}
      {plaidLinkToken && (
        <PlaidLinkHost
          token={plaidLinkToken}
          onSuccess={onPlaidLinkSuccess}
          onExit={() => { setPlaidLinkToken(null); setConnectingBank(false); }}
        />
      )}
    </>
  );
}
