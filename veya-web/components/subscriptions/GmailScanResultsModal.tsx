"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";

export type GmailScanRow = {
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

type GmailScanResultsModalProps = {
  open: boolean;
  candidates: GmailScanRow[];
  onClose: () => void;
  onSkip: () => void | Promise<void>;
  onImport: (messageIds: string[]) => void | Promise<void>;
  firstAutoComplete?: boolean;
  busy?: boolean;
};

export function GmailScanResultsModal({
  open,
  candidates,
  onClose,
  onSkip,
  onImport,
  firstAutoComplete = false,
  busy = false,
}: GmailScanResultsModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    for (const c of candidates) next[c.messageId] = true;
    setSelected(next);
  }, [open, candidates]);

  const selectedIds = useMemo(
    () => candidates.filter((c) => selected[c.messageId]).map((c) => c.messageId),
    [candidates, selected]
  );

  const n = candidates.length;

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const handleImport = async () => {
    await onImport(selectedIds);
  };

  const handleSkip = async () => {
    await onSkip();
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={n === 0 ? "We found no subscriptions in your Gmail" : `We found ${n} subscriptions in your Gmail`}
      className="max-w-lg"
    >
      {n > 0 && (
        <ul className="space-y-3 mb-6 max-h-[min(50vh,420px)] overflow-y-auto pr-1">
          {candidates.map((c) => (
            <li
              key={c.messageId}
              className="flex gap-3 rounded-xl border border-border bg-background-secondary/80 p-3 text-sm"
            >
              <label className="flex flex-1 cursor-pointer gap-3 items-start">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-border"
                  checked={!!selected[c.messageId]}
                  onChange={() => toggle(c.messageId)}
                  disabled={busy}
                />
                <span className="flex flex-1 min-w-0 flex-col gap-1">
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
                  </span>
                  <span className="text-text-secondary">
                    {formatCurrency(c.price)} / {c.billingCycle}
                    {c.billingCycle === "yearly" && (
                      <span className="text-text-tertiary">
                        {" "}
                        (≈ {formatCurrency(c.monthlyEquivalent)}/mo)
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    Found in email from: {c.emailDate}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
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
            disabled={busy || selectedIds.length === 0}
            onClick={handleImport}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Add {selectedIds.length} selected subscription{selectedIds.length === 1 ? "" : "s"}
          </button>
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
