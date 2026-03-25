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

type GmailInfo = {
  gmailConnected: boolean;
  lastGmailScanAt: string | null;
  lastGmailScanFoundCount: number;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plan, setPlan] = useState<"free" | "premium">("free");
  const [gmail, setGmail] = useState<GmailInfo | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

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
        body: JSON.stringify({ mode: "manual" }),
      });
      const j = await res.json();
      if (!j.ok && j.error) alert(j.error);
      else if (j.ok) {
        const lines = [j.summaryNew, j.summarySkipped].filter(Boolean).join("\n");
        if (lines) alert(lines);
      }
      await refreshGmail();
    } finally {
      setGmailLoading(false);
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
                ? "You have full access to AI coach, family sharing, and more."
                : "Upgrade for unlimited subscriptions, full analytics, and AI coach."}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Connected accounts
            </h2>
            {gmail ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Gmail:</span>
                  <Badge variant={gmail.gmailConnected ? "success" : "default"}>
                    {gmail.gmailConnected ? "Connected ✓" : "Not connected"}
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary">
                  Last scan: {scanLabel(gmail.lastGmailScanAt)} — last run added{" "}
                  {gmail.lastGmailScanFoundCount} subscription(s).
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
                <p className="text-xs text-text-tertiary">
                  Gmail is used only to find subscription receipts. You can add
                  subscriptions manually anytime.
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
            <Button variant="danger" disabled>
              Delete account (not implemented)
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
    </div>
  );
}
