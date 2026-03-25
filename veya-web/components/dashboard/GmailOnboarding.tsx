"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

type GmailSettings = {
  gmailConnected: boolean;
  gmailFirstScanCompletedAt: string | null;
};

type BannerState = "idle" | "scanning" | "success" | "hidden";

export function GmailOnboarding() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<BannerState>("idle");
  const [modal, setModal] = useState(false);
  const [foundCount, setFoundCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skipMessage, setSkipMessage] = useState<string | null>(null);
  const [summaryNew, setSummaryNew] = useState<string | null>(null);
  const scanStarted = useRef(false);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    scanStarted.current = false;
  }, [userId]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    let cancelled = false;

    async function run() {
      const g = (await fetch("/api/settings/gmail").then((r) => r.json())) as GmailSettings & {
        lastGmailScanAt: string | null;
      };
      if (cancelled) return;

      if (g.gmailFirstScanCompletedAt) {
        setBanner("hidden");
        return;
      }

      const provider = session?.provider ?? "credentials";
      const fromConnect = searchParams.get("gmail_connected") === "1";

      if (fromConnect) {
        router.replace("/dashboard", { scroll: false });
      }

      const shouldOfferModal =
        !g.gmailConnected &&
        !fromConnect &&
        (provider === "credentials" || provider === "google");

      if (shouldOfferModal) {
        setModal(true);
        return;
      }

      // Any sign-in with Gmail connected (Google OAuth or after Connect Gmail flow)
      const shouldAutoScan = g.gmailConnected && !scanStarted.current;

      if (!shouldAutoScan) {
        return;
      }

      scanStarted.current = true;
      setBanner("scanning");
      setModal(false);
      setSkipMessage(null);

      const j = await fetch("/api/subscriptions/gmail-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "first-auto" }),
      }).then((r) => r.json());

      if (cancelled) return;

      await qc.invalidateQueries({ queryKey: ["subscriptions"] });
      await qc.invalidateQueries({ queryKey: ["analytics"] });

      if (j.skipped) {
        setBanner("hidden");
        return;
      }

      if (j.needsGmail) {
        setModal(true);
        setBanner("idle");
        scanStarted.current = false;
        return;
      }

      if (j.ok) {
        setFoundCount(typeof j.found === "number" ? j.found : 0);
        setImportedCount(typeof j.imported === "number" ? j.imported : 0);
        setSkipMessage(typeof j.summarySkipped === "string" ? j.summarySkipped : null);
        setSummaryNew(typeof j.summaryNew === "string" && j.summaryNew ? j.summaryNew : null);
        setBanner("success");
        window.setTimeout(() => setBanner("hidden"), 14000);
      } else {
        setBanner("hidden");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [status, session?.provider, session?.user, userId, searchParams, router, qc]);

  const skipFirst = async () => {
    await fetch("/api/settings/gmail", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipFirstScan: true }),
    });
    setModal(false);
    setBanner("hidden");
    router.refresh();
  };

  const connectGmail = () => {
    const callbackUrl = encodeURIComponent("/dashboard?gmail_connected=1");
    window.location.href = `/api/auth/signin/google?callbackUrl=${callbackUrl}`;
  };

  return (
    <>
      {banner === "scanning" && (
        <div className="mb-4 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-text-secondary backdrop-blur-sm">
          🔍 Scanning your Gmail for subscriptions...
        </div>
      )}
      {banner === "success" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-text-primary sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span>
              ✅ Found {foundCount} subscription{foundCount === 1 ? "" : "s"}!
            </span>
            {summaryNew && (
              <p className="text-text-secondary text-xs">{summaryNew}</p>
            )}
            {importedCount > 0 && !summaryNew && (
              <p className="text-text-secondary text-xs">
                Added {importedCount} new to your list.
              </p>
            )}
            {skipMessage && (
              <p className="text-text-secondary text-xs">{skipMessage}</p>
            )}
          </div>
          <Link
            href="/subscriptions"
            className="font-medium text-accent hover:underline shrink-0"
          >
            View subscriptions →
          </Link>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Find subscriptions automatically?
            </h3>
            <p className="text-sm text-text-secondary mb-6">
              Want Veya to find your subscriptions automatically? Connect your Gmail
              to get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={connectGmail}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Connect Gmail
              </button>
              <button
                type="button"
                onClick={skipFirst}
                className="flex-1 rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm font-medium text-text-primary hover:bg-background"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
