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

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plan, setPlan] = useState<"free" | "premium">("free");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/billing")
        .then((r) => r.json())
        .then((d) => setPlan(d.plan ?? "free"))
        .catch(() => {});
    }
  }, [status]);

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
