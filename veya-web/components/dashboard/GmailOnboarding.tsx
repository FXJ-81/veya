"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  GmailScanResultsModal,
  type GmailScanRow,
} from "@/components/subscriptions/GmailScanResultsModal";
import { mergeScanCandidates } from "@/lib/mergeScanCandidates";
import { executeScanImport } from "@/lib/executeScanImport";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import type { ScanImportPayload } from "@/types/scan";

type GmailSettings = {
  gmailConnected: boolean;
  plaidLinked: boolean;
  hasAutoScanned: boolean;
  gmailFirstScanCompletedAt: string | null;
};

type BannerState = "idle" | "scanning" | "success" | "hidden";

export function GmailOnboarding() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<BannerState>("idle");
  const [connectModal, setConnectModal] = useState(false);
  const [resultsModal, setResultsModal] = useState(false);
  const [candidates, setCandidates] = useState<GmailScanRow[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [importBusy, setImportBusy] = useState(false);
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

      if (g.hasAutoScanned) {
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
        !g.plaidLinked &&
        !fromConnect &&
        (provider === "credentials" || provider === "google");

      if (shouldOfferModal) {
        setConnectModal(true);
        return;
      }

      const shouldAutoScan =
        (g.gmailConnected || g.plaidLinked) && !scanStarted.current;

      if (!shouldAutoScan) {
        return;
      }

      scanStarted.current = true;
      setBanner("scanning");
      setConnectModal(false);

      const gmailPromise = g.gmailConnected
        ? fetch("/api/subscriptions/gmail-scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "scan", mode: "first-auto" }),
          }).then((r) => r.json())
        : Promise.resolve({
            ok: false,
            skipped: false,
            needsGmail: false,
            candidates: [],
          });

      const plaidPromise = g.plaidLinked
        ? fetch("/api/plaid/detect-subscriptions", { method: "POST" }).then((r) =>
            r.json()
          )
        : Promise.resolve({ ok: false, subscriptions: [] });

      const [gj, pj] = await Promise.all([gmailPromise, plaidPromise]);

      if (cancelled) return;

      if (!g.plaidLinked && gj.needsGmail) {
        setConnectModal(true);
        setBanner("idle");
        scanStarted.current = false;
        return;
      }

      if (gj.skipped && !g.plaidLinked) {
        setBanner("hidden");
        return;
      }

      if (!g.plaidLinked && !gj.ok && !gj.needsGmail) {
        setBanner("hidden");
        scanStarted.current = false;
        return;
      }

      type GmailCandidate = {
        messageId: string;
        name: string;
        category: string;
        price: number;
        billingCycle: "monthly" | "yearly";
        monthlyEquivalent: number;
        logoUrl: string;
        emailDate: string;
        senderDomain: string;
      };
      const gmailRows: GmailScanRow[] = (
        gj.ok && Array.isArray(gj.candidates) ? gj.candidates : []
      ).map((c: GmailCandidate) => ({
        ...c,
        rowId: c.messageId,
        source: "gmail" as const,
      }));

      const plaidRows: GmailScanRow[] =
        pj.ok && Array.isArray(pj.subscriptions)
          ? mapPlaidDetectToScanRows(pj.subscriptions)
          : [];

      let merged: GmailScanRow[] = [];
      if (gmailRows.length && plaidRows.length) {
        merged = mergeScanCandidates(gmailRows, plaidRows);
      } else {
        merged = [...gmailRows, ...plaidRows];
      }

      if (merged.length > 0) {
        setFoundCount(merged.length);
        setCandidates(merged);
        setResultsModal(true);
        setBanner("success");
        window.setTimeout(() => setBanner("hidden"), 16000);
      } else {
        await fetch("/api/subscriptions/gmail-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss-first-auto" }),
        });
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
    setConnectModal(false);
    setBanner("hidden");
    router.refresh();
  };

  const connectGmail = () => {
    const callbackUrl = encodeURIComponent("/dashboard?gmail_connected=1");
    window.location.href = `/api/auth/signin/google?callbackUrl=${callbackUrl}`;
  };

  const dismissResults = async () => {
    setImportBusy(true);
    try {
      await fetch("/api/subscriptions/gmail-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss-first-auto" }),
      });
      setResultsModal(false);
      setBanner("hidden");
      await qc.invalidateQueries({ queryKey: ["subscriptions"] });
      router.refresh();
    } finally {
      setImportBusy(false);
    }
  };

  const importSelected = async (payload: ScanImportPayload) => {
    setImportBusy(true);
    try {
      await executeScanImport(payload, { firstAutoComplete: true });
      setResultsModal(false);
      setBanner("hidden");
      await qc.invalidateQueries({ queryKey: ["subscriptions"] });
      await qc.invalidateQueries({ queryKey: ["analytics"] });
      router.refresh();
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <>
      {banner === "scanning" && (
        <div className="mb-4 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-text-secondary backdrop-blur-sm">
          🔍 Finding your subscriptions...
        </div>
      )}
      {banner === "success" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-text-primary sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span>
            ✅ Found {foundCount} subscription{foundCount === 1 ? "" : "s"}! View them{" "}
            <Link href="/subscriptions" className="font-medium text-accent hover:underline">
              here
            </Link>
          </span>
        </div>
      )}

      <GmailScanResultsModal
        open={resultsModal}
        candidates={candidates}
        onClose={importBusy ? () => {} : dismissResults}
        onSkip={dismissResults}
        onImport={importSelected}
        firstAutoComplete
        busy={importBusy}
      />

      {connectModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Find subscriptions automatically?
            </h3>
            <p className="text-sm text-text-secondary mb-6">
              Want Veya to find your subscriptions automatically? Connect your Gmail to get
              started.
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
