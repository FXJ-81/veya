"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import { keysForPlaidMerchant } from "@/lib/plaidSyncCore";
import type { ScanImportResult } from "@/lib/executeScanImport";
import type { GmailScanRow, ScanImportPayload, SubscriptionScanSource } from "@/types/scan";

export type { GmailScanRow, ScanImportPayload } from "@/types/scan";

type GmailScanResultsModalProps = {
  open: boolean;
  candidates: GmailScanRow[];
  onClose: () => void;
  onSkip: () => void | Promise<void>;
  onImport: (payload: ScanImportPayload) => Promise<ScanImportResult>;
  /** Called after selections are applied when the modal should close (Gmail-only flow, or bank summary "Done"). */
  onAfterImportClose?: () => void;
  /** Persist unchecked bank-sourced rows as declined merchants (Settings / Subscriptions). */
  persistPlaidDeclinedMerchants?: (keys: string[]) => Promise<void>;
  firstAutoComplete?: boolean;
  busy?: boolean;
};

function rowKey(c: GmailScanRow, index: number): string {
  return c.rowId ?? c.messageId ?? `scan-${index}`;
}

function sourceLabel(source?: SubscriptionScanSource): string {
  if (source === "plaid") return "Found in bank";
  if (source === "confirmed") return "Confirmed";
  return "Found in Gmail";
}

function isPlaidLikeScanRow(c: GmailScanRow): boolean {
  if (c.source === "plaid") return true;
  if (c.source === "confirmed" && !c.messageId && c.lastCharged) return true;
  return false;
}

/** User-facing copy after bank-sourced rows are saved (no "import" wording). */
function bankSubscriptionAddSummaryCopy(added: number, skipped: number): { headline: string; detail: string } {
  if (added === 0 && skipped === 0) {
    return {
      headline: "You're all set",
      detail: "No new subscriptions were added from your bank this time.",
    };
  }
  if (added === 0 && skipped > 0) {
    if (skipped === 1) {
      return {
        headline: "Nothing new to add",
        detail: "That subscription was already on your list.",
      };
    }
    return {
      headline: "Nothing new to add",
      detail: `${skipped} subscriptions were already on your list.`,
    };
  }
  if (added > 0 && skipped === 0) {
    if (added === 1) {
      return {
        headline: "Subscription added",
        detail: "1 new subscription from your bank was saved to your list.",
      };
    }
    return {
      headline: "Subscriptions added",
      detail: `${added} new subscriptions from your bank were saved to your list.`,
    };
  }
  const addedPart =
    added === 1 ? "1 new subscription was added" : `${added} new subscriptions were added`;
  const skippedPart =
    skipped === 1 ? "1 was already on your list" : `${skipped} were already on your list`;
  return {
    headline: "Subscriptions added",
    detail: `${addedPart}. ${skippedPart}.`,
  };
}

/** Unchecked bank-sourced rows → normalized merchant keys to remember as declined. */
function collectDeclinedPlaidMerchantKeys(
  rows: GmailScanRow[],
  selected: Record<string, boolean>,
): string[] {
  const keys = new Set<string>();
  rows.forEach((c, i) => {
    if (!isPlaidLikeScanRow(c)) return;
    const rk = rowKey(c, i);
    if (selected[rk]) return;
    for (const dk of keysForPlaidMerchant({ name: c.name, merchantName: c.merchantName })) {
      keys.add(dk);
    }
  });
  return [...keys];
}

export function GmailScanResultsModal({
  open,
  candidates,
  onClose,
  onSkip,
  onImport,
  onAfterImportClose,
  persistPlaidDeclinedMerchants,
  firstAutoComplete = false,
  busy = false,
}: GmailScanResultsModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [plaidImportSummary, setPlaidImportSummary] = useState<{
    added: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setPlaidImportSummary(null);
      return;
    }
    const next: Record<string, boolean> = {};
    candidates.forEach((c, i) => {
      next[rowKey(c, i)] = c.defaultSelected !== false;
    });
    setSelected(next);
  }, [open, candidates]);

  const selectedRows = useMemo(
    () =>
      candidates.filter((c, i) => {
        const k = rowKey(c, i);
        return !!selected[k];
      }),
    [candidates, selected]
  );

  const primaryActionLabel = useMemo(() => {
    const nSel = selectedRows.length;
    if (nSel === 0) return "Add subscriptions";
    const onlyRestore = selectedRows.every((r) => r.previouslyCanceled);
    if (onlyRestore) {
      return nSel === 1 ? "Restore subscription" : "Restore subscriptions";
    }
    return `Add ${nSel} subscription${nSel === 1 ? "" : "s"}`;
  }, [selectedRows]);

  const n = candidates.length;

  const bankSummaryCopy = plaidImportSummary
    ? bankSubscriptionAddSummaryCopy(plaidImportSummary.added, plaidImportSummary.skipped)
    : null;

  const title = useMemo(() => {
    if (n === 0) return "We found no subscription candidates";
    const sources = new Set(candidates.map((c) => c.source ?? "gmail"));
    const mixed =
      (sources.has("gmail") && sources.has("plaid")) || sources.has("confirmed");
    if (mixed) return `We found ${n} subscription candidates`;
    if (sources.has("plaid") && !sources.has("gmail"))
      return `We found ${n} subscriptions from your bank`;
    return `We found ${n} subscriptions in your Gmail`;
  }, [n, candidates]);

  const toggle = (key: string) => {
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  };

  const buildPayload = (): ScanImportPayload => {
    const gmailMessageIds: string[] = [];
    const plaidItems: ScanImportPayload["plaidItems"] = [];
    for (const c of selectedRows) {
      if (c.source === "confirmed" && c.messageId) {
        gmailMessageIds.push(c.messageId);
        continue;
      }
      if (c.source === "gmail" && c.messageId) {
        gmailMessageIds.push(c.messageId);
        continue;
      }
      if (c.source === "plaid" || (c.source === "confirmed" && !c.messageId)) {
        if (!c.lastCharged) continue;
        plaidItems.push({
          name: c.name,
          merchantName: c.merchantName ?? c.name,
          category: c.category,
          price: c.price,
          billingCycle:
            c.billingCycle === "custom" ? "monthly" : c.billingCycle,
          lastCharged: c.lastCharged,
          ...(c.resumeSubscriptionId
            ? { resumeSubscriptionId: c.resumeSubscriptionId }
            : {}),
        });
        continue;
      }
      if (c.messageId) gmailMessageIds.push(c.messageId);
      else if (c.lastCharged) {
        plaidItems.push({
          name: c.name,
          merchantName: c.merchantName ?? c.name,
          category: c.category,
          price: c.price,
          billingCycle:
            c.billingCycle === "custom" ? "monthly" : c.billingCycle,
          lastCharged: c.lastCharged,
          ...(c.resumeSubscriptionId
            ? { resumeSubscriptionId: c.resumeSubscriptionId }
            : {}),
        });
      }
    }
    return { gmailMessageIds, plaidItems };
  };

  const finishAfterImport = () => {
    setPlaidImportSummary(null);
    (onAfterImportClose ?? onClose)();
  };

  const handleImport = async () => {
    const declinedKeys = collectDeclinedPlaidMerchantKeys(candidates, selected);
    const payload = buildPayload();
    const result = await onImport(payload);
    if (declinedKeys.length && persistPlaidDeclinedMerchants) {
      await persistPlaidDeclinedMerchants(declinedKeys);
    }
    if (payload.plaidItems.length > 0) {
      setPlaidImportSummary({
        added: result.plaidAdded,
        skipped: result.plaidSkipped,
      });
    } else {
      finishAfterImport();
    }
  };

  const handleSkip = async () => {
    const declinedKeys = collectDeclinedPlaidMerchantKeys(candidates, selected);
    if (declinedKeys.length && persistPlaidDeclinedMerchants) {
      await persistPlaidDeclinedMerchants(declinedKeys);
    }
    await onSkip();
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : plaidImportSummary ? finishAfterImport : onClose}
      title={title}
      className="max-w-lg"
    >
      {bankSummaryCopy && (
        <div className="mb-4 rounded-xl border border-border bg-background-secondary/80 px-4 py-3 text-sm text-text-primary">
          <p className="font-medium text-text-primary">{bankSummaryCopy.headline}</p>
          <p className="mt-1 text-text-secondary leading-relaxed">{bankSummaryCopy.detail}</p>
        </div>
      )}

      {n > 0 && !plaidImportSummary && (
        <ul className="space-y-3 mb-6 max-h-[min(50vh,420px)] overflow-y-auto pr-1">
          {candidates.map((c, index) => {
            const key = rowKey(c, index);
            return (
              <li
                key={key}
                className="flex gap-3 rounded-xl border border-border bg-background-secondary/80 p-3 text-sm"
              >
                <label className="flex flex-1 cursor-pointer gap-3 items-start">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-border"
                    checked={!!selected[key]}
                    onChange={() => toggle(key)}
                    disabled={busy || !!plaidImportSummary}
                  />
                  <span className="flex flex-1 min-w-0 flex-col gap-1">
                    <div className="flex flex-col gap-0.5">
                      {c.previouslyCanceled ? (
                        <span className="text-[11px] font-semibold tracking-wide text-amber-200/95">
                          Previously canceled
                        </span>
                      ) : null}
                      <span className="text-[11px] text-text-tertiary">
                        {sourceLabel(c.source)}
                      </span>
                      {c.previouslyCanceled ? (
                        <span className="text-[10px] leading-snug text-text-tertiary">
                          Same charge pattern as before—you can restore it to your active list.
                        </span>
                      ) : null}
                    </div>
                    <span className="flex items-center gap-2 font-medium text-text-primary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded-lg object-contain bg-white/5 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="truncate">{c.name}</span>
                      {c.confidence && (
                        <span className="text-[10px] uppercase text-text-tertiary shrink-0">
                          {c.confidence}
                        </span>
                      )}
                    </span>
                    <span className="text-text-secondary">
                      {c.source === "plaid" ? (
                        <>
                          {formatCurrency(c.price)}/mo
                          <span className="text-text-tertiary"> (from bank)</span>
                        </>
                      ) : c.billingCycle === "yearly" ? (
                        <>
                          {formatCurrency(c.price)} / year
                          <span className="text-text-tertiary">
                            {" "}
                            (≈ {formatCurrency(c.monthlyEquivalent)}/mo)
                          </span>
                        </>
                      ) : (
                        <>
                          {formatCurrency(c.price)} / {c.billingCycle}
                        </>
                      )}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {c.emailDate
                        ? `Found in email: ${c.emailDate}`
                        : c.lastCharged
                          ? `Last charged: ${c.lastCharged}`
                          : null}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        {plaidImportSummary ? (
          <button
            type="button"
            onClick={finishAfterImport}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleSkip}
              className="rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm font-medium text-text-primary hover:bg-background disabled:opacity-50"
            >
              Skip
            </button>
            {n > 0 && (
              <button
                type="button"
                disabled={busy || selectedRows.length === 0}
                onClick={handleImport}
                className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {primaryActionLabel}
              </button>
            )}
          </>
        )}
      </div>
      {firstAutoComplete && n === 0 && (
        <p className="mt-4 text-xs text-text-tertiary">
          You can add subscriptions manually anytime from the Subscriptions page.
        </p>
      )}
    </Modal>
  );
}
