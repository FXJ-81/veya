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
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

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
    }
  }, [status]);

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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-4 pr-4 pt-16 pb-6 md:pl-56 md:pr-6 md:pt-8 md:pb-8">
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
            <p className="text-sm text-text-secondary">
              Renewal reminders and alerts can be configured here. (UI toggles
              can be wired to UserSettings in the API.)
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Security
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Change password and 2FA settings. (Implement via NextAuth or
              custom API.)
            </p>
          </Card>

          <Card className="border-danger/30">
            <h2 className="text-lg font-semibold text-danger mb-2">
              Danger zone
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Delete your account and all data. This cannot be undone.
            </p>
            <Button variant="danger" onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteToast(null); }}>
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

      {deleteToast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm rounded-xl border border-danger/30 bg-card px-4 py-3 text-sm text-text-primary shadow-lg">
          <div className="font-medium text-danger mb-1">Error</div>
          <div className="text-text-secondary">{deleteToast}</div>
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
