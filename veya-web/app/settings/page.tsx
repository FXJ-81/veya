"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type FormEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PlaidLinkHost } from "@/components/subscriptions/PlaidLinkHost";
import { PlaidSecurityBadges } from "@/components/settings/PlaidSecurityBadges";
import { SupportFeedbackForm } from "@/components/settings/SupportFeedbackForm";
import { SettingsAccordionSection } from "@/components/settings/SettingsAccordionSection";
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import {
  applyAccentPreferenceToDocument,
  type AccentPreference,
} from "@/lib/accentPreference";
import { TriangleAlert, X } from "lucide-react";
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
    label: "Monthly spending summary",
    description: "Every month: your subscription recap",
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

function bankConnectionLabel(bankName: string): string {
  const clean = bankName.trim() || "Bank";
  const withBank = /\bbank\b/i.test(clean) ? clean : `${clean} Bank`;
  return `${withBank} connected`;
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
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Inline errors (no more alert())
  const [bankError, setBankError] = useState<string | null>(null);

  // Plaid Link
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);

  // Disconnect confirmation
  const [confirmDisconnect, setConfirmDisconnect] = useState<PlaidAccountRow | null>(null);

  // Clear all subscriptions
  const [clearSubsOpen, setClearSubsOpen] = useState(false);
  const [clearSubsAck, setClearSubsAck] = useState(false);
  const [clearSubsBusy, setClearSubsBusy] = useState(false);

  // Account deletion
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
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

  const [accentPreference, setAccentPreference] = useState<AccentPreference>("brand");
  const [accentPrefLoading, setAccentPrefLoading] = useState(true);
  const [accentSaving, setAccentSaving] = useState(false);
  const accentPreferenceRef = useRef(accentPreference);
  accentPreferenceRef.current = accentPreference;
  const accentSavingRef = useRef(false);

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
        if (res.status === 403 && d.code === "PREMIUM_REQUIRED") {
          setPlaidAccounts([]);
          return;
        }
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

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setAccentPrefLoading(false);
      return;
    }
    setAccentPrefLoading(true);
    void fetch("/api/settings/appearance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { accentPreference?: unknown } | null) => {
        const v: AccentPreference = d?.accentPreference === "white" ? "white" : "brand";
        setAccentPreference(v);
        applyAccentPreferenceToDocument(v);
      })
      .catch(() => {})
      .finally(() => setAccentPrefLoading(false));
  }, [status]);

  const saveAccentPreference = useCallback(async (next: AccentPreference) => {
    const prev = accentPreferenceRef.current;
    if (next === prev || accentSavingRef.current) return;
    accentSavingRef.current = true;
    setAccentSaving(true);
    setAccentPreference(next);
    applyAccentPreferenceToDocument(next);
    try {
      const res = await fetch("/api/settings/appearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentPreference: next }),
      });
      if (!res.ok) throw new Error("save failed");
      const d = (await res.json()) as { accentPreference?: unknown };
      const v: AccentPreference = d.accentPreference === "white" ? "white" : "brand";
      setAccentPreference(v);
      applyAccentPreferenceToDocument(v);
    } catch {
      setAccentPreference(prev);
      applyAccentPreferenceToDocument(prev);
    } finally {
      accentSavingRef.current = false;
      setAccentSaving(false);
    }
  }, []);

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

      // Store any newly detected subscriptions silently.
      // Review happens only on the Subscriptions page.
      try {
        const det = await fetch("/api/plaid/detect-subscriptions", { method: "POST" });
        const dj = await det.json().catch(() => ({}));
        if (det.ok && dj.ok) {
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

  const runClearAllSubscriptions = async () => {
    if (!clearSubsAck) return;
    setClearSubsBusy(true);
    setBankError(null);
    try {
      const res = await fetch("/api/subscriptions/clear-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "CLEAR_ALL_SUBSCRIPTIONS" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Could not clear subscriptions");
      await invalidateAfterSubscriptionChange(qc);
      setClearSubsOpen(false);
      setClearSubsAck(false);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Could not clear subscriptions");
    } finally {
      setClearSubsBusy(false);
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

  const switchPlan = async (nextPlan: "free" | "premium") => {
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: nextPlan === "premium" ? "upgrade" : "downgrade" }),
    });
    const json = await res.json();
    if (json.plan) setPlan(json.plan);
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((d: { prefs?: Record<NotificationPrefKey, boolean> }) => {
        if (d.prefs) setNotifPrefs(d.prefs);
      })
      .catch(() => {});
  };

  const runDeleteAccount = async () => {
    setDeleteToast(null);
    if (deleteConfirm.trim() !== "DELETE") {
      setDeleteToast("Type DELETE exactly to confirm.");
      return;
    }
    if (hasPassword === true && !deleteAccountPassword.trim()) {
      setDeleteToast("Enter your current account password to continue.");
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationPhrase: deleteConfirm.trim(),
          ...(hasPassword === true ? { currentPassword: deleteAccountPassword } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setDeleteOpen(false);
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setDeleteToast(e instanceof Error ? e.message : "Failed to delete account");
      setDeleteBusy(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  const anyBankBusy = connectingBank || disconnectingId !== null;

  return (
    <>
      <AppShell>
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-5 sm:mb-6"
        >
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Settings</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-text-secondary">
            Open a section when you need it. Less clutter, same controls.
          </p>
        </motion.header>

        <div className="mx-auto w-full min-w-0 max-w-2xl space-y-3 sm:space-y-4 pb-2">
          <SettingsAccordionSection
            id="settings-account"
            title="Account"
            description="Profile and signing out of this device"
            defaultOpen
          >
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
            <div className="mt-6 border-t border-border/60 pt-5">
              <Button
                className="w-full sm:w-auto"
                variant="secondary"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </Button>
            </div>
          </SettingsAccordionSection>

          <SettingsAccordionSection
            id="settings-billing"
            title="Billing & plan"
            description="Your plan and tracked subscription data"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* In column layout, flex children default to stretch — without w-fit/self-start the badge reads as a full-width bar */}
              <Badge
                className="w-fit shrink-0 self-start sm:self-auto"
                variant={plan === "premium" ? "accent" : "default"}
              >
                {plan === "premium" ? "Premium" : "Free"}
              </Badge>
              <Button
                className="w-full sm:w-auto"
                variant={plan === "premium" ? "secondary" : "primary"}
                onClick={() => void switchPlan(plan === "premium" ? "free" : "premium")}
              >
                {plan === "premium" ? "Switch to Free" : "Upgrade to Premium"}
              </Button>
            </div>
            <p className="mt-2 text-sm text-text-secondary max-md:mt-3">
              {plan === "premium"
                ? "You have unlimited subscriptions, unlimited AI Coach, analytics, and notifications."
                : "Free includes 10 subscriptions, bank linking, budget tracking, and 5 AI messages per day."}
            </p>
            <div className="mt-8 border-t border-border/60 pt-6">
              <h3 className="mb-2 text-sm font-semibold text-text-primary">Tracked subscription data</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Remove every subscription you track in Veya. Bank connections and your declined bank
                detections are kept so sync behavior stays predictable.
              </p>
              <Button variant="danger" onClick={() => { setClearSubsAck(false); setClearSubsOpen(true); }}>
                Clear all subscriptions
              </Button>
            </div>
          </SettingsAccordionSection>

          <SettingsAccordionSection
            id="settings-banks"
            title="Banks & connected accounts"
            description="Link accounts so Veya can detect subscriptions from your transactions"
          >
            {plaidAccounts !== null && plaidAccounts.length > 0 && (
              <div className="mb-4 flex justify-end">
                <Button variant="secondary" className="shrink-0" onClick={startPlaidLink} disabled={anyBankBusy}>
                  {connectingBank ? "Opening…" : "+ Add bank"}
                </Button>
              </div>
            )}

            {/* Error banner */}
            {bankError && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-danger">Something went wrong</p>
                  <p className="text-sm text-text-secondary">{bankError}</p>
                </div>
                <button
                  onClick={() => setBankError(null)}
                  className="shrink-0 text-text-tertiary hover:text-text-primary"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-sm font-semibold text-accent">
                  Bank
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
                  const isDisconnecting = disconnectingId === acc.id;

                  return (
                    <li
                      key={acc.id}
                      className={`rounded-xl border bg-background-secondary/20 p-4 transition-opacity ${
                        isDisconnecting ? "opacity-50" : "border-border"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Bank info */}
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-xs font-semibold text-accent">
                            Bank
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-text-primary">
                                {bankConnectionLabel(acc.bankName)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-text-tertiary">
                              Last checked: {scanLabel(acc.lastSync)}
                            </p>
                          </div>
                        </div>

                        <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
                          <Button
                            variant="danger"
                            className="w-full sm:w-auto min-w-[8.5rem]"
                            onClick={() => confirmAndDisconnect(acc)}
                            disabled={anyBankBusy || isDisconnecting}
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
          </SettingsAccordionSection>

          <SettingsAccordionSection
            id="settings-notifications"
            title="Notifications"
            description="Email and in-app alerts (Premium unlocks reminders)"
          >
            {notifPrefsLoading ? (
              <p className="text-sm text-text-tertiary">Loading…</p>
            ) : !notifPrefs ? (
              <p className="text-sm text-text-secondary">Could not load notification settings.</p>
            ) : (
              <ul className="divide-y divide-border">
                {NOTIFICATION_SETTING_ROWS.map((row) => {
                  const locked = plan !== "premium";
                  return (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-text-primary">{row.label}</p>
                          {locked && (
                            <Badge variant="default">Premium</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-text-tertiary">
                          {locked ? "Upgrade to Premium to use notification reminders." : row.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!locked && notifPrefs[row.key]}
                        disabled={locked}
                        onClick={() => void toggleNotifPref(row.key)}
                        className={cn(
                          "relative inline-flex h-8 w-[3.25rem] shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background",
                          locked ? "cursor-not-allowed bg-border opacity-60" : "cursor-pointer",
                          !locked && notifPrefs[row.key] ? "bg-accent" : "bg-border",
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none mt-0.5 inline-block h-6 w-6 rounded-full bg-white shadow transition duration-200 ease-out",
                            !locked && notifPrefs[row.key] ? "translate-x-[1.35rem]" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsAccordionSection>

          <SettingsAccordionSection
            id="settings-appearance"
            title="Appearance"
            description="Choose between Dark and Light"
          >
            {accentPrefLoading ? (
              <p className="text-sm text-text-tertiary">Loading…</p>
            ) : (
              <fieldset disabled={accentSaving} className="space-y-3">
                <legend className="sr-only">Theme</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={accentPreference === "brand"}
                    onClick={() => void saveAccentPreference("brand")}
                    className={cn(
                      "rounded-xl border px-4 py-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      accentPreference === "brand"
                        ? "border-accent bg-accent/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "border-border bg-background-secondary/25 hover:border-border hover:bg-background-secondary/40",
                    )}
                  >
                    <span className="mb-2 block h-9 w-full rounded-lg border border-border/80 bg-[#0b0b12]" aria-hidden />
                    <span className="text-sm font-semibold text-text-primary">Dark</span>
                    <span className="mt-0.5 block text-xs text-text-tertiary">Dark theme</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={accentPreference === "white"}
                    onClick={() => void saveAccentPreference("white")}
                    className={cn(
                      "rounded-xl border px-4 py-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      accentPreference === "white"
                        ? "border-accent bg-accent/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "border-border bg-background-secondary/25 hover:border-border hover:bg-background-secondary/40",
                    )}
                  >
                    <span className="mb-2 block h-9 w-full rounded-lg border border-border/80 bg-white" aria-hidden />
                    <span className="text-sm font-semibold text-text-primary">Light</span>
                    <span className="mt-0.5 block text-xs text-text-tertiary">Light theme</span>
                  </button>
                </div>
              </fieldset>
            )}
          </SettingsAccordionSection>

          <SettingsAccordionSection
            id="settings-support"
            title="Support & feedback"
            description="Questions, bugs, or product ideas"
          >
            <div className="rounded-xl border border-border/80 bg-background-secondary/25 p-4 sm:p-5">
              <SupportFeedbackForm />
            </div>
          </SettingsAccordionSection>

          <SettingsAccordionSection
            id="settings-security"
            title="Security"
            description="Password and active sessions"
          >
            <div className="space-y-8">
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

              <div className="border-t border-border/70 pt-6">
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
          </SettingsAccordionSection>

          <SettingsAccordionSection
            id="settings-delete-account"
            title="Delete account"
            description="Permanently delete your account and all associated data."
            className="border-danger/35 bg-card/60"
          >
            <Button
              className="w-full sm:w-auto"
              variant="danger"
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm("");
                setDeleteAccountPassword("");
                setDeleteToast(null);
              }}
            >
              Delete account
            </Button>
          </SettingsAccordionSection>
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
        onClose={() => {
          if (!deleteBusy) setDeleteOpen(false);
        }}
        title="Permanently delete your account?"
        className="max-w-md"
      >
        <div className="mb-4 space-y-2 text-sm text-text-secondary">
          <p>This action is permanent and cannot be undone.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile, subscriptions, budgets, and analytics history in Veya will be removed.</li>
            <li>AI conversations, notifications, and linked bank connections for this account will be removed.</li>
            <li>Families you created as admin will be deleted along with their membership data.</li>
          </ul>
        </div>
        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-tertiary">
            Type <span className="font-mono font-semibold text-text-primary">DELETE</span> to confirm
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            disabled={deleteBusy}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        {hasPassword === true ? (
          <div className="mb-4">
            <label className="mb-2 block text-sm text-text-tertiary">Current password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={deleteAccountPassword}
              onChange={(e) => setDeleteAccountPassword(e.target.value)}
              disabled={deleteBusy}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <p className="mt-1.5 text-xs text-text-tertiary">
              Required because this account uses email and password sign-in.
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => setDeleteOpen(false)}
            disabled={deleteBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            className="w-full sm:w-auto"
            onClick={() => void runDeleteAccount()}
            disabled={
              deleteBusy ||
              hasPassword === null ||
              deleteConfirm.trim() !== "DELETE" ||
              (hasPassword === true && !deleteAccountPassword.trim())
            }
            isLoading={deleteBusy}
          >
            Delete account
          </Button>
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

      <Modal
        open={clearSubsOpen}
        onClose={() => { if (!clearSubsBusy) { setClearSubsOpen(false); setClearSubsAck(false); } }}
        title="Clear all subscriptions?"
        className="max-w-md"
      >
        <p className="mb-4 text-sm text-text-secondary">
          This removes all subscriptions from your Veya account. Dashboard totals, renewals, and
          analytics will update after you confirm. This does not cancel charges with your providers.
        </p>
        <label className="mb-6 flex cursor-pointer items-start gap-3 text-sm text-text-primary">
          <input
            type="checkbox"
            className="mt-1 rounded border-border"
            checked={clearSubsAck}
            onChange={(e) => setClearSubsAck(e.target.checked)}
            disabled={clearSubsBusy}
          />
          <span>I understand that all tracked subscriptions will be permanently removed from Veya.</span>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => { setClearSubsOpen(false); setClearSubsAck(false); }}
            disabled={clearSubsBusy}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="w-full sm:w-auto"
            onClick={() => void runClearAllSubscriptions()}
            disabled={clearSubsBusy || !clearSubsAck}
          >
            {clearSubsBusy ? "Removing…" : "Clear all subscriptions"}
          </Button>
        </div>
      </Modal>

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
