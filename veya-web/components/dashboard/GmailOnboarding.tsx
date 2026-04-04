"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import {
  GmailScanResultsModal,
  type GmailScanRow,
} from "@/components/subscriptions/GmailScanResultsModal";
import { mapPlaidDetectToScanRows } from "@/lib/plaidScanRows";
import { executeScanImport } from "@/lib/executeScanImport";
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import type { ScanImportPayload } from "@/types/scan";

type ConnectionSettings = {
  plaidLinked: boolean;
  hasAutoScanned: boolean;
};

type BannerState = "idle" | "scanning" | "success" | "hidden";

/** First-login flow: optional bank link prompt + Plaid-only auto-detect (no Gmail scanning). */
export function GmailOnboarding() {
  const { data: session, status } = useSession();
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
    if (status !== "authenticated") return;

    let cancelled = false;

    async function run() {
      const g = (await fetch("/api/settings/gmail").then((r) => r.json())) as ConnectionSettings;
      if (cancelled) return;

      if (g.hasAutoScanned) {
        setBanner("hidden");
        return;
      }

      const shouldOfferModal = !g.plaidLinked;
      if (shouldOfferModal) {
        setConnectModal(true);
        return;
      }

      const shouldAutoScan = g.plaidLinked && !scanStarted.current;
      if (!shouldAutoScan) return;

      scanStarted.current = true;
      setBanner("scanning");
      setConnectModal(false);

      const pj = await fetch("/api/plaid/detect-subscriptions", { method: "POST" }).then((r) =>
        r.json(),
      );
      if (cancelled) return;

      const plaidRows: GmailScanRow[] =
        pj.ok && Array.isArray(pj.subscriptions)
          ? mapPlaidDetectToScanRows(pj.subscriptions)
          : [];

      if (plaidRows.length > 0) {
        setFoundCount(plaidRows.length);
        setCandidates(plaidRows);
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

    void run();
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

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
      await invalidateAfterSubscriptionChange(qc);
      router.refresh();
    } finally {
      setImportBusy(false);
    }
  };

  const importSelected = async (payload: ScanImportPayload) => {
    setImportBusy(true);
    try {
      const result = await executeScanImport(payload, { firstAutoComplete: true });
      await invalidateAfterSubscriptionChange(qc);
      router.refresh();
      return result;
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <>
      {banner === "scanning" && (
        <div className="mb-4 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-text-secondary backdrop-blur-sm">
          🔍 Finding subscriptions from your bank…
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
        onAfterImportClose={() => {
          setResultsModal(false);
          setBanner("hidden");
        }}
        firstAutoComplete
        busy={importBusy}
      />

      <Modal
        open={connectModal}
        onClose={() => void skipFirst()}
        title="Find subscriptions automatically?"
        className="max-w-md"
      >
        <p className="mb-6 text-sm text-text-secondary">
          Connect your bank on Settings (Plaid). Veya can scan transactions to suggest subscriptions to add.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/settings"
            className="flex flex-1 items-center justify-center rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            Open Settings
          </Link>
          <button
            type="button"
            onClick={skipFirst}
            className="flex-1 rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm font-medium text-text-primary hover:bg-background"
          >
            Skip for now
          </button>
        </div>
      </Modal>
    </>
  );
}
