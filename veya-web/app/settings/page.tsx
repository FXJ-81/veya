"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { executeScanImport } from "@/lib/executeScanImport";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import type { ScanImportPayload } from "@/types/scan";

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

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plan, setPlan] = useState<"free" | "premium">("free");
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccountRow[] | null>(null);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [gmailResultsOpen, setGmailResultsOpen] = useState(false);
  const [gmailCandidates, setGmailCandidates] = useState<GmailScanRow[]>([]);
  const [gmailImportBusy, setGmailImportBusy] = useState(false);
  const [plaidBusy, setPlaidBusy] = useState(false);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState("this device");
  const [signOutAllBusy, setSignOutAllBusy] = useState(false);

  const strength = useMemo(() => strengthScore(newPw), [newPw]);

  useEffect(() => {
    setSessionLabel(browserSessionLabel());
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/billing")
        .then((r) => r.json())
        .then((d) => setPlan(d.plan ?? "free"))
        .catch(() => {});
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
      fetch("/api/user/password")
        .then((r) => r.json())
        .then((d: { hasPassword?: boolean }) => setHasPassword(!!d.hasPassword))
        .catch(() => setHasPassword(false));
    }
  }, [status]);

  const refreshBank = () =>
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
      });

  const closeGmailResults = () => {
    if (gmailImportBusy) return;
    setGmailResultsOpen(false);
  };

  const importScanSelection = async (payload: ScanImportPayload) => {
    setGmailImportBusy(true);
    try {
      await executeScanImport(payload);
      setGmailResultsOpen(false);
      await refreshBank();
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
      if (!res.ok || !j.link_token) throw new Error(j.error ?? "Could not start bank linking");
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
      await refreshBank();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Bank linking failed");
    } finally {
      setPlaidBusy(false);
    }
  };

  const disconnectAccount = async (id: string) => {
    setPlaidBusy(true);
    try {
      const res = await fetch(`/api/plaid/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Disconnect failed");
        return;
      }
      await refreshBank();
    } finally {
      setPlaidBusy(false);
    }
  };

  const resyncPlaid = async (plaidAccountId?: string) => {
    if (!plaidAccounts?.length) return;
    setResyncingId(plaidAccountId ?? "__all__");
    setPlaidBusy(true);
    try {
      const det = await fetch("/api/plaid/detect-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plaidAccountId ? { plaidAccountId } : {}),
      });
      const dj = await det.json().catch(() => ({}));
      if (!det.ok || !dj.ok) {
        alert(dj.error ?? "Resync failed");
        return;
      }
      setGmailCandidates(
        mapPlaidDetectToScanRows(Array.isArray(dj.subscriptions) ? dj.subscriptions : []),
      );
      setGmailResultsOpen(true);
      await refreshBank();
    } finally {
      setResyncingId(null);
      setPlaidBusy(false);
    }
  };

  const scanLabel = (iso: string | null) => {
    if (!iso) return "Never";
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d <= 0) return "Today";
    if (d === 1) return "1 day ago";
    return `${d} days ago`;
  };

  const submitPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwErr("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr("New password and confirmation don’t match.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwErr((j as { error?: string }).error ?? "Could not update password.");
        return;
      }
      setPwMsg("Password updated successfully.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
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

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  const runDeleteAccount = async () => {
    setDeleteToast(null);
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      // Ensure client session clears too.
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setDeleteToast(e instanceof Error ? e.message : "Failed to delete account");
      setDeleteBusy(false);
    }
  };

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
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Profile
            </h2>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent">
                {(session?.user?.name ?? session?.user?.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-text-primary">
                  {session?.user?.name ?? "No name"}
                </p>
                <p className="text-sm text-text-secondary">
                  {session?.user?.email}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Plan
            </h2>
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
            <p className="text-sm text-text-secondary mt-2">
              {plan === "premium"
                ? "You have full access to AI coach, full analytics, and more."
                : "Upgrade for unlimited subscriptions, full analytics, and AI coach."}
            </p>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Connected accounts
            </h2>
            {plaidAccounts === null ? (
              <p className="text-sm text-text-secondary">Loading…</p>
            ) : (
              <div className="space-y-4">
                {plaidAccounts.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-text-secondary">No bank connected yet.</p>
                    <Button className="w-full sm:w-auto" onClick={startPlaidLink} disabled={plaidBusy}>
                      {plaidBusy ? "…" : "🏦 Connect bank account"}
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {plaidAccounts.map((acc) => {
                      const syncingThis = resyncingId === acc.id;
                      const syncingAny = resyncingId !== null || plaidBusy;
                      return (
                        <li
                          key={acc.id}
                          className="rounded-xl border border-border bg-background-secondary/20 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium text-text-primary">{acc.bankName}</p>
                              <p className="mt-1 text-sm text-text-secondary">
                                Last synced: {scanLabel(acc.lastSync)}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <Button
                                className="w-full sm:w-auto"
                                variant="secondary"
                                onClick={() => void resyncPlaid(acc.id)}
                                disabled={syncingAny}
                              >
                                {syncingThis ? "Syncing…" : "Resync"}
                              </Button>
                              <Button
                                className="w-full sm:w-auto"
                                variant="danger"
                                onClick={() => void disconnectAccount(acc.id)}
                                disabled={plaidBusy || resyncingId !== null}
                              >
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {plaidAccounts.length > 0 && (
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={startPlaidLink}
                    disabled={plaidBusy || resyncingId !== null}
                  >
                    {plaidBusy ? "…" : "Connect another bank"}
                  </Button>
                )}
                <p className="text-xs text-text-tertiary">
                  Plaid reads transactions to suggest subscriptions you can add.
                </p>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Notifications</h2>
            <ul className="space-y-4 text-sm text-text-secondary">
              <li>
                <p className="font-medium text-text-primary">New subscription alerts</p>
                <p className="mt-0.5">When bank detects a new subscription.</p>
              </li>
              <li>
                <p className="font-medium text-text-primary">Renewal reminders</p>
                <p className="mt-0.5">Heads-up before subscription renewals.</p>
              </li>
            </ul>
          </Card>

          <Card>
            <h2 className="mb-6 text-lg font-semibold text-text-primary">Security</h2>
            <div className="space-y-10">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-text-primary">Change password</h3>
                {hasPassword === false ? (
                  <p className="max-w-md text-sm text-text-secondary">
                    You sign in with Google. Password change isn’t available for this account.
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
                            className={`h-1.5 flex-1 rounded-full ${
                              i < strength ? "bg-accent" : "bg-border"
                            }`}
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
                      <Link
                        href="/forgot-password"
                        className="text-sm text-accent hover:underline"
                      >
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
                    <p className="text-sm text-text-primary">
                      Current session — {sessionLabel}
                    </p>
                    <Badge variant="success" className="mt-2">
                      This device
                    </Badge>
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

          <Card className="border-danger/30">
            <h2 className="text-lg font-semibold text-danger mb-2">
              Danger zone
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Delete your account and all data. This cannot be undone.
            </p>
            <Button
              className="w-full sm:w-auto"
              variant="danger"
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm("");
                setDeleteToast(null);
              }}
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

      {deleteToast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm rounded-xl border border-danger/30 bg-card px-4 py-3 text-sm text-text-primary shadow-lg">
          <div className="font-medium text-danger mb-1">Error</div>
          <div className="text-text-secondary">{deleteToast}</div>
        </div>
      )}

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleteBusy) setDeleteOpen(false);
        }}
        title="Delete your account?"
        className="max-w-md"
      >
        <p className="mb-4 text-sm text-text-secondary">
          This will permanently delete your account and all your data including subscriptions, chat
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
          <Button
            className="w-full sm:w-auto"
            variant="secondary"
            onClick={() => setDeleteOpen(false)}
            disabled={deleteBusy}
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={runDeleteAccount}
            disabled={deleteBusy || deleteConfirm !== "DELETE"}
            className="min-h-[44px] w-full rounded-xl px-4 py-2 text-sm font-medium text-background transition-colors disabled:opacity-50 sm:min-h-0 sm:w-auto"
            style={{ background: "#f87171" }}
          >
            {deleteBusy ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </Modal>

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
    </>
  );
}
