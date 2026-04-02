"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { BudgetStatus } from "@/app/api/budgets/status/route";

// ─── category config ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  __total__: "💰",
  Streaming: "📺",
  Music: "🎵",
  Productivity: "💼",
  Storage: "☁️",
  Gaming: "🎮",
  Education: "📚",
  News: "📰",
  Health: "🏃",
  "Food & Dining": "🍔",
  AI: "🤖",
  Other: "📦",
  Entertainment: "🎭",
  Finance: "💳",
  Transport: "🚗",
  Travel: "✈️",
  Utilities: "🔌",
  Shopping: "🛍️",
};

const KNOWN_CATEGORIES = [
  "Streaming", "Music", "Productivity", "Storage", "Gaming",
  "Education", "News", "Health", "Food & Dining", "AI",
  "Entertainment", "Finance", "Transport", "Travel",
  "Utilities", "Shopping", "Other",
];

function categoryIcon(cat: string) {
  return CATEGORY_ICONS[cat] ?? "📦";
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function ProgressBar({ pct, exceeded }: { pct: number; exceeded: boolean }) {
  const clamped = Math.min(pct, 100);
  const color =
    pct >= 100
      ? "bg-red-600"
      : pct >= 90
      ? "bg-red-500"
      : pct >= 70
      ? "bg-yellow-400"
      : "bg-emerald-500";

  return (
    <div className="relative h-2 w-full rounded-full bg-surface overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color} ${exceeded ? "animate-pulse" : ""}`}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── Budget card ─────────────────────────────────────────────────────────────

function BudgetCard({
  bs,
  onEdit,
  onDelete,
}: {
  bs: BudgetStatus;
  onEdit: (bs: BudgetStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isTotal = bs.category === "__total__";
  const label = isTotal ? "Total subscriptions" : bs.category;
  const exceeded = bs.percentage >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-2xl border p-5 ${
        isTotal
          ? "border-accent/40 bg-accent/5"
          : exceeded
          ? "border-red-500/30 bg-red-950/20"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{categoryIcon(bs.category)}</span>
          <div>
            <p className="font-semibold text-text-primary text-sm">{label}</p>
            {isTotal && (
              <p className="text-xs text-text-tertiary">All subscriptions combined</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-sm font-bold ${
              exceeded
                ? "text-red-400"
                : bs.status === "warning"
                ? "text-yellow-400"
                : "text-emerald-400"
            }`}
          >
            {bs.percentage.toFixed(0)}%
          </span>
          <button
            onClick={() => onEdit(bs)}
            className="ml-2 rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary border border-border hover:border-accent hover:text-accent transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(bs.id)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary border border-border hover:border-danger hover:text-danger transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <ProgressBar pct={bs.percentage} exceeded={exceeded} />

      <div className="flex justify-between mt-2 text-xs text-text-secondary">
        <span>
          <span className="text-text-primary font-medium">${bs.spent.toFixed(2)}</span> spent
          {" "}of{" "}
          <span className="text-text-primary font-medium">${bs.limit.toFixed(2)}</span> limit
        </span>
        {exceeded ? (
          <span className="text-red-400 font-medium">
            Over by ${Math.abs(bs.remaining).toFixed(2)}
          </span>
        ) : (
          <span className="text-text-tertiary">${bs.remaining.toFixed(2)} remaining</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Add/Edit modal ──────────────────────────────────────────────────────────

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
  const isTotal = editing?.category === "__total__";
  const [category, setCategory] = useState(editing?.category ?? "");
  const [limitStr, setLimitStr] = useState(editing ? String(editing.limit) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const used = new Set(existingCategories);
  const available = ["__total__", ...KNOWN_CATEGORIES].filter(
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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
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
            {isTotal ? (
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
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete confirm ──────────────────────────────────────────────────────────

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
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
          This will permanently remove this budget. You can always create a new one.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { status } = useSession();
  const router = useRouter();
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  const reload = useCallback(async () => {
    const res = await fetch("/api/budgets/status");
    if (!res.ok) return;
    const j = await res.json();
    setStatuses(j.statuses ?? []);
    setTotalSpend(j.totalMonthlySpend ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") reload();
  }, [status, reload]);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  const totalBudgeted = statuses
    .filter((s) => s.category !== "__total__")
    .reduce((sum, s) => sum + s.limit, 0);

  const onTrack = statuses.filter(
    (s) => s.category !== "__total__" && s.status === "under"
  ).length;
  const total = statuses.filter((s) => s.category !== "__total__").length;

  const alerts = statuses.filter((s) => s.status !== "under");

  const totalCard = statuses.find((s) => s.category === "__total__");
  const categoryCards = statuses.filter((s) => s.category !== "__total__");

  const existingCategories = statuses.map((s) => s.category);

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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-56 pr-6 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Budget</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Track your monthly spending limits by category
            </p>
          </div>
          <Button onClick={() => setModal({ type: "add" })}>+ Add Budget</Button>
        </motion.div>

        {/* Alert banners */}
        <AnimatePresence>
          {alerts.map((a) => {
            const exceeded = a.percentage >= 100;
            const label = a.category === "__total__" ? "Total subscriptions" : a.category;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mb-3 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                  exceeded
                    ? "bg-red-950/60 border border-red-500/30 text-red-300"
                    : "bg-yellow-950/60 border border-yellow-500/30 text-yellow-300"
                }`}
              >
                {exceeded ? "🚨" : "⚠️"}
                {exceeded
                  ? `You've exceeded your ${label} budget by $${Math.abs(a.remaining).toFixed(2)}`
                  : `You're close to your ${label} limit — $${a.remaining.toFixed(2)} remaining`}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <p className="text-xs text-text-tertiary mb-1">Total budgeted</p>
            <p className="text-2xl font-bold text-text-primary">${totalBudgeted.toFixed(2)}</p>
            <p className="text-xs text-text-secondary mt-0.5">per month across all categories</p>
          </Card>
          <Card>
            <p className="text-xs text-text-tertiary mb-1">Total spent this month</p>
            <p className="text-2xl font-bold text-text-primary">${totalSpend.toFixed(2)}</p>
            <p className="text-xs text-text-secondary mt-0.5">from active subscriptions</p>
          </Card>
          <Card>
            <p className="text-xs text-text-tertiary mb-1">Budgets on track</p>
            <p className="text-2xl font-bold text-text-primary">
              {onTrack} <span className="text-base font-normal text-text-secondary">of {total}</span>
            </p>
            <p className="text-xs text-text-secondary mt-0.5">budgets under limit</p>
          </Card>
        </div>

        {/* Budget list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-border bg-card p-16 text-center"
          >
            <p className="text-4xl mb-4">💰</p>
            <p className="text-lg font-semibold text-text-primary mb-2">No budgets yet</p>
            <p className="text-sm text-text-secondary mb-6">
              Set spending limits for each subscription category to stay on track.
            </p>
            <Button onClick={() => setModal({ type: "add" })}>Add your first budget</Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Total budget card first */}
            <AnimatePresence>
              {totalCard && (
                <BudgetCard
                  key={totalCard.id}
                  bs={totalCard}
                  onEdit={(bs) => setModal({ type: "edit", bs })}
                  onDelete={(id) => setDeleteTarget(id)}
                />
              )}
            </AnimatePresence>

            {/* Category budgets */}
            {categoryCards.length > 0 && (
              <div className="space-y-3">
                <AnimatePresence>
                  {categoryCards.map((bs) => (
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
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <BudgetModal
            key="budget-modal"
            mode={modal}
            existingCategories={existingCategories}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )}
        {deleteTarget && (
          <DeleteConfirm
            key="delete-confirm"
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            busy={deleteBusy}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
