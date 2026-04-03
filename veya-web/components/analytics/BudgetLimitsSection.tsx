"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BudgetStatus } from "@/app/api/budgets/status/route";
import {
  SUBSCRIPTION_CATEGORIES,
  categoryIcon,
} from "@/lib/subscriptionCategories";

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
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{categoryIcon(bs.category)}</span>
          <span className="text-sm font-medium text-text-primary truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`text-xs font-bold ${
              exceeded ? "text-red-400" :
              bs.status === "warning" ? "text-yellow-400" :
              "text-emerald-400"
            }`}
          >
            {bs.percentage.toFixed(0)}%
          </span>
          <button
            onClick={() => onEdit(bs)}
            className="ml-1 rounded px-2 py-0.5 text-xs text-text-secondary border border-border hover:border-accent hover:text-accent transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(bs.id)}
            className="rounded px-2 py-0.5 text-xs text-text-secondary border border-border hover:border-danger hover:text-danger transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <ProgressBar pct={bs.percentage} />

      <div className="flex justify-between mt-1.5 text-xs text-text-secondary">
        <span>
          <span className="text-text-primary font-medium">${bs.spent.toFixed(2)}</span>
          {" "}spent of{" "}
          <span className="text-text-primary font-medium">${bs.limit.toFixed(2)}</span> limit
        </span>
        {exceeded ? (
          <span className="text-red-400">Over by ${Math.abs(bs.remaining).toFixed(2)}</span>
        ) : (
          <span>${bs.remaining.toFixed(2)} left</span>
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
    (c) => !used.has(c) || c === editing?.category
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-sm rounded-2xl border border-border p-6"
        style={{ background: "#111118" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {editing ? "Edit budget" : "Add budget"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">Category</label>
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
                    {c === "__total__" ? "💰 Total subscriptions" : `${categoryIcon(c)} ${c}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">Monthly limit ($)</label>
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

          {err && <p className="text-xs text-danger">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── delete confirm ───────────────────────────────────────────────────────────

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl border border-border p-6"
        style={{ background: "#111118" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-primary mb-2">Delete budget?</h3>
        <p className="text-sm text-text-secondary mb-5">
          This will permanently remove this budget limit.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "#f87171" }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── main exported section ────────────────────────────────────────────────────

export function BudgetLimitsSection() {
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/budgets/status");
    if (!res.ok) return;
    const j = await res.json();
    setStatuses(j.statuses ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

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
    await reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await fetch(`/api/budgets/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      await reload();
    } finally {
      setDeleteBusy(false);
    }
  };

  const existingCategories = statuses.map((s) => s.category);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">Budget Limits</h3>
          <button
            onClick={() => setModal({ type: "add" })}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            + Add Budget
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-3">💰</p>
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

      <AnimatePresence>
        {modal && (
          <BudgetModal
            key="modal"
            mode={modal}
            existingCategories={existingCategories}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )}
        {deleteTarget && (
          <DeleteConfirm
            key="delete"
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            busy={deleteBusy}
          />
        )}
      </AnimatePresence>
    </>
  );
}
