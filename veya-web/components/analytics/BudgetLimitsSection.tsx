"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { BudgetStatus } from "@/app/api/budgets/status/route";
import { Modal } from "@/components/ui/Modal";
import { SUBSCRIPTION_CATEGORIES, categorySelectLabel } from "@/lib/categories";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Pencil, Trash2, Wallet } from "lucide-react";
import { useBudgetStatuses } from "@/hooks/useBudgetStatus";
import { invalidateAfterBudgetChange } from "@/lib/invalidateSubscriptionQueries";

// ─── progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color =
    pct >= 100 ? "bg-red-700" :
    pct >= 90  ? "bg-red-500" :
    pct >= 70  ? "bg-yellow-400" :
                 "bg-emerald-500";

  return (
    <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color} ${pct >= 100 ? "animate-pulse" : ""}`}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── budget card ─────────────────────────────────────────────────────────────

function BudgetCard({
  bs,
  onEdit,
  onDelete,
}: {
  bs: BudgetStatus;
  onEdit: (bs: BudgetStatus) => void;
  onDelete: (id: string) => void;
}) {
  const exceeded = bs.percentage >= 100;
  const label = bs.category === "__total__" ? "Total subscriptions" : bs.category;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`rounded-xl border p-4 ${
        exceeded ? "border-red-500/30 bg-red-950/20" : "border-border bg-card"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CategoryIcon category={bs.category} className="h-4 w-4 text-text-tertiary" />
          <span className="truncate text-sm font-medium text-text-primary">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={`text-sm font-bold ${
              exceeded ? "text-red-400" :
              bs.status === "warning" ? "text-yellow-400" :
              "text-emerald-400"
            }`}
          >
            {bs.percentage.toFixed(0)}%
          </span>
          <button
            type="button"
            onClick={() => onEdit(bs)}
            aria-label={`Edit budget for ${label}`}
            className="ml-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-border text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent md:min-h-0 md:min-w-0 md:px-2 md:py-0.5"
          >
            <span className="hidden md:inline">Edit</span>
            <Pencil className="h-4 w-4 md:hidden" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDelete(bs.id)}
            aria-label={`Delete budget for ${label}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-border text-sm text-text-secondary transition-colors hover:border-danger hover:text-danger md:min-h-0 md:min-w-0 md:px-2 md:py-0.5"
          >
            <span className="hidden md:inline">Delete</span>
            <Trash2 className="h-4 w-4 md:hidden" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <ProgressBar pct={bs.percentage} />
      </div>

      <div className="mt-1.5 flex flex-col gap-1 text-xs text-text-secondary sm:flex-row sm:justify-between sm:gap-2">
        <span className="min-w-0 break-words">
          <span className="font-medium text-text-primary">${bs.spent.toFixed(2)}</span>
          {" "}spent of{" "}
          <span className="font-medium text-text-primary">${bs.limit.toFixed(2)}</span> limit
        </span>
        {exceeded ? (
          <span className="shrink-0 text-red-400">Over by ${Math.abs(bs.remaining).toFixed(2)}</span>
        ) : (
          <span className="shrink-0">${bs.remaining.toFixed(2)} left</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── add / edit modal ─────────────────────────────────────────────────────────

type ModalMode = { type: "add" } | { type: "edit"; bs: BudgetStatus };

function BudgetModal({
  mode,
  existingCategories,
  onClose,
  onSave,
}: {
  mode: ModalMode;
  existingCategories: string[];
  onClose: () => void;
  onSave: (data: { category: string; limit: number }) => Promise<void>;
}) {
  const editing = mode.type === "edit" ? mode.bs : null;
  const [category, setCategory] = useState(editing?.category ?? "");
  const [limitStr, setLimitStr] = useState(editing ? String(editing.limit) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const used = new Set(existingCategories);
  const available = ["__total__", ...SUBSCRIPTION_CATEGORIES].filter(
    (c) => !used.has(c) || c === editing?.category,
  );

  const handleSave = async () => {
    setErr("");
    const limit = parseFloat(limitStr);
    if (!category) return setErr("Select a category.");
    if (isNaN(limit) || limit <= 0) return setErr("Enter a valid positive limit.");
    setBusy(true);
    try {
      await onSave({ category, limit });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      fullScreenMobile
      onClose={() => {
        if (!busy) onClose();
      }}
      title={editing ? "Edit budget" : "Add budget"}
      className="max-w-sm"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-text-tertiary">Category</label>
          {editing?.category === "__total__" ? (
            <p className="text-sm font-medium text-text-primary">Total subscriptions</p>
          ) : (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!!editing}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
            >
              <option value="">Select category…</option>
              {available.map((c) => (
                <option key={c} value={c}>
                  {categorySelectLabel(c)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-text-tertiary">Monthly limit ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={limitStr}
            onChange={(e) => setLimitStr(e.target.value)}
            placeholder="e.g. 50"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50 sm:min-h-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="min-h-[44px] rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:min-h-0"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirm({
  onConfirm,
  onCancel,
  busy,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onCancel();
      }}
      title="Delete budget?"
      className="max-w-sm"
    >
      <p className="text-sm text-text-secondary mb-5">
        This will permanently remove this budget limit.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50 sm:min-h-0"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50 sm:min-h-0"
          style={{ background: "#f87171" }}
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

// ─── main exported section ────────────────────────────────────────────────────

export function BudgetLimitsSection() {
  const qc = useQueryClient();
  const {
    data: statuses = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useBudgetStatuses();
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleSave = async (data: { category: string; limit: number }) => {
    if (modal?.type === "edit") {
      const res = await fetch(`/api/budgets/${modal.bs.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: data.limit }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Update failed");
    } else {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Create failed");
    }
    setModal(null);
    await invalidateAfterBudgetChange(qc);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await fetch(`/api/budgets/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      await invalidateAfterBudgetChange(qc);
    } finally {
      setDeleteBusy(false);
    }
  };

  const existingCategories = statuses.map((s) => s.category);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Budget Limits</h3>
          <button
            type="button"
            onClick={() => setModal({ type: "add" })}
            className="min-h-[44px] w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 min-[420px]:w-auto sm:min-h-0"
          >
            + Add Budget
          </button>
        </div>

        {isError ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm">
            <p className="font-medium text-danger">
              {error instanceof Error ? error.message : "Could not load budgets"}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mb-3 flex justify-center" aria-hidden>
              <Wallet className="h-10 w-10 text-text-tertiary" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">No budget limits set</p>
            <p className="text-xs text-text-secondary">
              Set monthly spending limits per category to track your budget.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {statuses.map((bs) => (
                <BudgetCard
                  key={bs.id}
                  bs={bs}
                  onEdit={(b) => setModal({ type: "edit", bs: b })}
                  onDelete={(id) => setDeleteTarget(id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {modal && (
        <BudgetModal
          key={modal.type === "edit" ? modal.bs.id : "add"}
          mode={modal}
          existingCategories={existingCategories}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          key={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}
