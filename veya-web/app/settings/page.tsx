"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  GmailScanResultsModal,
  type GmailScanRow,
} from "@/components/subscriptions/GmailScanResultsModal";
import { PlaidLinkHost } from "@/components/subscriptions/PlaidLinkHost";
import { executeScanImport } from "@/lib/executeScanImport";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import type { ScanImportPayload } from "@/types/scan";

type GmailInfo = {
  gmailConnected: boolean;
  plaidLinked: boolean;
  lastPlaidSync: string | null;
  lastGmailScanAt: string | null;
  lastGmailScanFoundCount: number;
};

type NotifPrefs = {
  renewalReminders: boolean;
  budgetAlerts: boolean;
  weeklyDigest: boolean;
  newSubDetected: boolean;
  priceAlerts: boolean;
};

function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const isWin = /Windows/i.test(ua);
  const isMac = /Mac/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
  const isEdg = /Edg/i.test(ua);
  let browser = "Browser";
  if (isChrome) browser = "Chrome";
  else if (isEdg) browser = "Edge";
  else if (isFirefox) browser = "Firefox";
  else if (isSafari) browser = "Safari";
  let os = "device";
  if (isWin) os = "Windows";
  else if (isMac) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  return `${browser} on ${os}`;
}

function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

function strengthLabel(score: number): string {
  if (score <= 1) return "Weak";
  if (score === 2) return "Fair";
  if (score === 3) return "Good";
  return "Strong";
}

function NotifToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="min-w-0 pr-2">
        <p className="font-medium text-text-primary text-sm">{label}</p>
        <p className="text-xs text-text-secondary mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors flex items-center focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50",
          checked ? "bg-success justify-end" : "justify-start bg-[#3f3f4f]"
        )}
      >
        <span className="pointer-events-none block h-6 w-6 rounded-full bg-white shadow-md" />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plan, setPlan] = useState<"free" | "premium">("free");
  const [gmail, setGmail] = useState<GmailInfo | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailResultsOpen, setGmailResultsOpen] = useState(false);
  const [gmailCandidates, setGmailCandidates] = useState<GmailScanRow[]>([]);
  const [gmailImportBusy, setGmailImportBusy] = useState(false);
  const [plaidBusy, setPlaidBusy] = useState(false);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null);
  const [twoFAAwaitingCode, setTwoFAAwaitingCode] = useState(false);
  const [twoFAOtp, setTwoFAOtp] = useState("");
  const [twoFASendBusy, setTwoFASendBusy] = useState(false);
  const [twoFAVerifyBusy, setTwoFAVerifyBusy] = useState(false);
  const [twoFAResendSec, setTwoFAResendSec] = useState(0);
  const [twoFAInlineMsg, setTwoFAInlineMsg] = useState<string | null>(null);
  const [signoutBusy, setSignoutBusy] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState("This device");

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
        .then((d) => setGmail(d))
        .catch(() => {});
      fetch("/api/user/settings")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return;
          setNotifPrefs({
            renewalReminders: d.renewalReminders ?? true,
            budgetAlerts: d.budgetAlerts ?? true,
            weeklyDigest: d.weeklyDigest ?? true,
            newSubDetected: d.newSubDetected ?? true,
            priceAlerts: d.priceAlerts ?? true,
          });
          setHasPassword(!!d.hasPassword);
        })
        .catch(() => {});
      fetch("/api/auth/2fa/status")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return;
          setTwoFAEnabled(!!d.twoFactorEnabled);
        })
        .catch(() => {});
    }
  }, [status]);

  useEffect(() => {
    setDeviceLabel(getDeviceLabel());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (twoFAResendSec <= 0) return;
    const t = setTimeout(() => setTwoFAResendSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [twoFAResendSec]);

  const refreshGmail = () =>
    fetch("/api/settings/gmail")
      .then((r) => r.json())
      .then((d) => setGmail(d));

  const connectGmail = () => {
    const callbackUrl = encodeURIComponent("/settings?gmail_connected=1");
    window.location.href = `/api/auth/signin/google?callbackUrl=${callbackUrl}`;
  };

  const disconnectGmail = async () => {
    setGmailLoading(true);
    try {
      await fetch("/api/settings/gmail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disconnectGmail: true }),
      });
      await refreshGmail();
    } finally {
      setGmailLoading(false);
    }
  };

  const rescanGmail = async () => {
    if (!gmail?.gmailConnected) return;
    setGmailLoading(true);
    try {
      const res = await fetch("/api/subscriptions/gmail-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", mode: "manual" }),
      });
      const j = await res.json();
      if (!j.ok && j.error) alert(j.error);
      else if (j.ok && Array.isArray(j.candidates)) {
        const mapped = (j.candidates as GmailScanRow[]).map((c) => ({
          ...c,
          rowId: c.messageId ?? c.rowId,
          source: "gmail" as const,
        }));
        setGmailCandidates(mapped);
        setGmailResultsOpen(true);
      }
      await refreshGmail();
    } finally {
      setGmailLoading(false);
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
      await refreshGmail();
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
      await refreshGmail();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Bank linking failed");
    } finally {
      setPlaidBusy(false);
    }
  };

  const disconnectPlaid = async () => {
    setPlaidBusy(true);
    try {
      await fetch("/api/settings/gmail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disconnectPlaid: true }),
      });
      await refreshGmail();
    } finally {
      setPlaidBusy(false);
    }
  };

  const resyncPlaid = async () => {
    if (!gmail?.plaidLinked) return;
    setPlaidBusy(true);
    try {
      const det = await fetch("/api/plaid/detect-subscriptions", { method: "POST" });
      const dj = await det.json().catch(() => ({}));
      if (!det.ok || !dj.ok) {
        alert(dj.error ?? "Resync failed");
        return;
      }
      setGmailCandidates(
        mapPlaidDetectToScanRows(Array.isArray(dj.subscriptions) ? dj.subscriptions : [])
      );
      setGmailResultsOpen(true);
      await refreshGmail();
    } finally {
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

  const handleUpgrade = async () => {
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upgrade" }),
    });
    const json = await res.json();
    if (json.plan) setPlan(json.plan);
  };

  const updateNotif = async (key: keyof NotifPrefs, value: boolean) => {
    if (!notifPrefs) return;
    const prev: NotifPrefs = { ...notifPrefs };
    setNotifPrefs({ ...notifPrefs, [key]: value });
    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setToast({ type: "success", message: "Notification preference saved." });
    } catch (e) {
      setNotifPrefs(prev);
      setToast({ type: "error", message: e instanceof Error ? e.message : "Save failed" });
    }
  };

  const submitPassword = async () => {
    if (pwNew !== pwConfirm) {
      setToast({ type: "error", message: "New passwords do not match." });
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pwNew,
          confirmPassword: pwConfirm,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Update failed");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setToast({ type: "success", message: j.message ?? "Password updated." });
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setPwBusy(false);
    }
  };

  const signOutOthers = async () => {
    setSignoutBusy(true);
    try {
      const res = await fetch("/api/auth/signout-all", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setToast({ type: "success", message: "Signed out all other devices." });
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSignoutBusy(false);
    }
  };

  const sendTwoFACode = async (): Promise<boolean> => {
    setTwoFASendBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/send-code", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to send code");
      setTwoFAResendSec(30);
      return true;
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Failed to send code" });
      return false;
    } finally {
      setTwoFASendBusy(false);
    }
  };

  const startEnable2FA = async () => {
    setTwoFAInlineMsg(null);
    setTwoFAOtp("");
    setTwoFAAwaitingCode(true);
    const ok = await sendTwoFACode();
    if (!ok) setTwoFAAwaitingCode(false);
  };

  const startDisable2FA = async () => {
    setTwoFAInlineMsg(null);
    setTwoFAOtp("");
    setTwoFAAwaitingCode(true);
    const ok = await sendTwoFACode();
    if (!ok) setTwoFAAwaitingCode(false);
  };

  const verifyTwoFACode = async () => {
    setTwoFAVerifyBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFAOtp }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Verification failed");
      setTwoFAEnabled(!!j.twoFactorEnabled);
      setTwoFAAwaitingCode(false);
      setTwoFAOtp("");
      if (j.twoFactorEnabled) {
        setTwoFAInlineMsg("✅ 2FA enabled successfully");
      } else {
        setTwoFAInlineMsg("2FA disabled");
      }
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Verification failed" });
    } finally {
      setTwoFAVerifyBusy(false);
    }
  };

  const cancelTwoFAFlow = () => {
    setTwoFAAwaitingCode(false);
    setTwoFAOtp("");
  };

  const pwScore = scorePassword(pwNew);
  const pwStrengthText = strengthLabel(pwScore);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  const runDeleteAccount = async () => {
    setToast(null);
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      // Ensure client session clears too.
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Failed to delete account" });
      setDeleteBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-56 pr-6 py-8">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-bold text-text-primary mb-8"
        >
          Settings
        </motion.h1>

        <div className="space-y-6 max-w-2xl">
          <Card>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Profile
            </h2>
            <div className="flex items-center gap-4">
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
            <div className="flex items-center justify-between">
              <Badge variant={plan === "premium" ? "accent" : "default"}>
                {plan === "premium" ? "Premium" : "Free"}
              </Badge>
              {plan === "free" && (
                <Button onClick={handleUpgrade}>Upgrade to Premium</Button>
              )}
            </div>
            <p className="text-sm text-text-secondary mt-2">
              {plan === "premium"
                ? "You have full access to AI coach, full analytics, and more."
                : "Upgrade for unlimited subscriptions, full analytics, and AI coach."}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Connected accounts
            </h2>
            {gmail ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">Gmail:</span>
                    <Badge variant={gmail.gmailConnected ? "success" : "default"}>
                      {gmail.gmailConnected ? "Connected ✓" : "Not connected"}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Last scan: {scanLabel(gmail.lastGmailScanAt)} — last scan matched{" "}
                    {gmail.lastGmailScanFoundCount} subscription candidate(s).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!gmail.gmailConnected ? (
                      <Button onClick={connectGmail} disabled={gmailLoading}>
                        Connect Gmail
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={rescanGmail}
                          disabled={gmailLoading}
                        >
                          Rescan now
                        </Button>
                        <Button
                          variant="danger"
                          onClick={disconnectGmail}
                          disabled={gmailLoading}
                        >
                          Disconnect Gmail
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">Bank account:</span>
                    <Badge variant={gmail.plaidLinked ? "success" : "default"}>
                      {(gmail.plaidLinked ?? false) ? "Connected ✓" : "Not connected"}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Last synced: {scanLabel(gmail.lastPlaidSync)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {gmail.plaidLinked ?? false ? (
                      <>
                        <Button variant="secondary" onClick={resyncPlaid} disabled={plaidBusy}>
                          {plaidBusy ? "Syncing…" : "Resync bank"}
                        </Button>
                        <Button variant="danger" onClick={disconnectPlaid} disabled={plaidBusy}>
                          Disconnect bank
                        </Button>
                      </>
                    ) : (
                      <Button onClick={startPlaidLink} disabled={plaidBusy}>
                        {plaidBusy ? "…" : "🏦 Connect Bank Account"}
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-text-tertiary">
                  Gmail is used only to find subscription receipts. Bank linking uses Plaid to read
                  transactions for subscription detection.
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Loading…</p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Notifications
            </h2>
            {!notifPrefs ? (
              <p className="text-sm text-text-secondary">Loading…</p>
            ) : (
              <div className="rounded-xl border border-border/80 bg-surface/40 overflow-hidden px-4">
                <NotifToggle
                  label="Renewal reminders"
                  description="Get notified before subscriptions renew"
                  checked={notifPrefs.renewalReminders}
                  onChange={(v) => updateNotif("renewalReminders", v)}
                />
                <NotifToggle
                  label="Budget alerts"
                  description="Alert when approaching budget limits"
                  checked={notifPrefs.budgetAlerts}
                  onChange={(v) => updateNotif("budgetAlerts", v)}
                />
                <NotifToggle
                  label="Weekly spending summary"
                  description="Weekly email with your spending recap"
                  checked={notifPrefs.weeklyDigest}
                  onChange={(v) => updateNotif("weeklyDigest", v)}
                />
                <NotifToggle
                  label="New subscription detected"
                  description="When Gmail or bank detects a new subscription"
                  checked={notifPrefs.newSubDetected}
                  onChange={(v) => updateNotif("newSubDetected", v)}
                />
                <NotifToggle
                  label="Price increase alerts"
                  description="When a subscription price changes"
                  checked={notifPrefs.priceAlerts}
                  onChange={(v) => updateNotif("priceAlerts", v)}
                />
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-text-primary mb-6">
              Security
            </h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Change password</h3>
                {!hasPassword ? (
                  <p className="text-sm text-text-secondary">
                    No password set for this account. Sign in with Google or use forgot password from the sign-in page
                    to set one.
                  </p>
                ) : (
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1.5">Current password</label>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        value={pwCurrent}
                        onChange={(e) => setPwCurrent(e.target.value)}
                        disabled={pwBusy}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1.5">New password</label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        disabled={pwBusy}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1.5">Confirm new password</label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        disabled={pwBusy}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-colors",
                              i < pwScore ? "bg-success" : "bg-border"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-text-tertiary">
                        Password strength: <span className="text-text-secondary">{pwStrengthText}</span>
                      </p>
                    </div>
                    <Button onClick={submitPassword} disabled={pwBusy || !pwCurrent || !pwNew || !pwConfirm}>
                      {pwBusy ? "Updating…" : "Update password"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6">
                {twoFAEnabled === null ? (
                  <p className="text-sm text-text-secondary">Loading…</p>
                ) : twoFAAwaitingCode ? (
                  <div className="space-y-4 max-w-md">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary mb-1">Two-Factor Authentication</h3>
                      <p className="text-sm text-text-secondary">
                        Enter the code sent to {session?.user?.email ?? "your email"}
                      </p>
                    </div>
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={twoFAOtp}
                      onChange={(e) => setTwoFAOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={twoFAVerifyBusy}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void sendTwoFACode()}
                        disabled={twoFASendBusy || twoFAResendSec > 0}
                      >
                        {twoFAResendSec > 0 ? `Resend (${twoFAResendSec}s)` : "Resend"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void verifyTwoFACode()}
                        disabled={twoFAVerifyBusy || twoFAOtp.length !== 6}
                        isLoading={twoFAVerifyBusy}
                      >
                        Verify
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={cancelTwoFAFlow}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : twoFAEnabled ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-success">✅ Two-Factor Authentication Enabled</p>
                      {twoFAInlineMsg && (
                        <p className="text-sm text-text-secondary mt-2">{twoFAInlineMsg}</p>
                      )}
                    </div>
                    <Button type="button" variant="danger" onClick={() => void startDisable2FA()}>
                      Disable 2FA
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Two-Factor Authentication</h3>
                      <p className="text-sm text-text-secondary mt-1">
                        Add an extra layer of security to your account
                      </p>
                      {twoFAInlineMsg && (
                        <p className="text-sm text-text-secondary mt-2">{twoFAInlineMsg}</p>
                      )}
                    </div>
                    <Button type="button" variant="success" onClick={() => void startEnable2FA()}>
                      Enable 2FA
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Active sessions</h3>
                <div className="rounded-xl border border-border/80 bg-surface/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">
                      <span className="text-text-tertiary">Device:</span> {deviceLabel}
                    </p>
                    <p className="text-sm text-text-secondary mt-1">
                      <span className="text-text-tertiary">Location:</span> Current session
                    </p>
                  </div>
                  <Badge variant="success" className="self-start sm:self-center">
                    This device
                  </Badge>
                </div>
                <div className="mt-4">
                  <Button variant="secondary" onClick={signOutOthers} disabled={signoutBusy}>
                    {signoutBusy ? "Signing out…" : "Sign out all other devices"}
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
            <Button variant="danger" onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setToast(null); }}>
              Delete account
            </Button>
          </Card>

          <div className="pt-4">
            <Button
              variant="secondary"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </main>

      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-[60] max-w-sm rounded-xl border bg-card px-4 py-3 text-sm text-text-primary shadow-lg",
            toast.type === "success" ? "border-success/30" : "border-danger/30"
          )}
        >
          <div
            className={cn(
              "font-medium mb-1",
              toast.type === "success" ? "text-success" : "text-danger"
            )}
          >
            {toast.type === "success" ? "Success" : "Error"}
          </div>
          <div className="text-text-secondary">{toast.message}</div>
        </div>
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDeleteOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-5"
            style={{ background: "#111118", borderColor: "#2a2a3a" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Delete your account?
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              This will permanently delete your account and all your data including subscriptions,
              chat history, and settings. This cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-xs text-text-tertiary mb-2">
                Type <span className="text-text-primary font-semibold">DELETE</span> to confirm
              </label>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                disabled={deleteBusy}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteBusy}
              >
                Cancel
              </Button>
              <button
                onClick={runDeleteAccount}
                disabled={deleteBusy || deleteConfirm !== "DELETE"}
                className="rounded-xl px-4 py-2 text-sm font-medium text-background transition-colors disabled:opacity-50"
                style={{ background: "#f87171" }}
              >
                {deleteBusy ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
