"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@/types";
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import { QUERY_KEYS } from "@/lib/queryKeys";

export type SubscriptionListData = {
  subscriptions: Subscription[];
  plan: "free" | "premium";
  subscriptionLimit: number | null;
  subscriptionCount: number;
  subscriptionRemaining: number | null;
};

async function fetchSubscriptions(): Promise<SubscriptionListData> {
  const res = await fetch("/api/subscriptions");
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
  const body = await res.json();
  if (Array.isArray(body)) {
    return {
      subscriptions: body,
      plan: "free",
      subscriptionLimit: null,
      subscriptionCount: body.length,
      subscriptionRemaining: null,
    };
  }
  return {
    subscriptions: Array.isArray(body.subscriptions) ? body.subscriptions : [],
    plan: body.plan === "premium" ? "premium" : "free",
    subscriptionLimit: typeof body.subscriptionLimit === "number" ? body.subscriptionLimit : null,
    subscriptionCount:
      typeof body.subscriptionCount === "number"
        ? body.subscriptionCount
        : Array.isArray(body.subscriptions)
          ? body.subscriptions.length
          : 0,
    subscriptionRemaining:
      typeof body.subscriptionRemaining === "number" ? body.subscriptionRemaining : null,
  };
}

export function useSubscriptions() {
  return useQuery({
    queryKey: QUERY_KEYS.subscriptions,
    queryFn: fetchSubscriptions,
    staleTime: 0,
  });
}

export function useSubscriptionMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (body: Partial<Subscription>) => {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create");
      }
      return (await res.json()) as Subscription;
    },
    onSuccess: async (data) => {
      qc.setQueryData<SubscriptionListData>(QUERY_KEYS.subscriptions, (old) => {
        const list = old?.subscriptions ?? [];
        const nextSubscriptions = list.some((s) => s.id === data.id)
          ? list.map((s) => (s.id === data.id ? data : s))
          : [...list, data];
        if (!old) {
          return {
            subscriptions: nextSubscriptions,
            plan: "free",
            subscriptionLimit: null,
            subscriptionCount: nextSubscriptions.length,
            subscriptionRemaining: null,
          };
        }
        const countDelta = list.some((s) => s.id === data.id) ? 0 : 1;
        return {
          ...old,
          subscriptions: nextSubscriptions,
          subscriptionCount: old.subscriptionCount + countDelta,
          subscriptionRemaining:
            old.subscriptionRemaining == null ? null : Math.max(0, old.subscriptionRemaining - countDelta),
        };
      });
      await invalidateAfterSubscriptionChange(qc);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: Partial<Subscription> & { id: string }) => {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update");
      }
      return (await res.json()) as Subscription;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.subscriptions });
      const previous = qc.getQueryData<SubscriptionListData>(QUERY_KEYS.subscriptions);
      qc.setQueryData<SubscriptionListData>(QUERY_KEYS.subscriptions, (old) =>
        old
          ? {
              ...old,
              subscriptions: old.subscriptions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(QUERY_KEYS.subscriptions, ctx.previous);
      }
    },
    onSuccess: async (data) => {
      qc.setQueryData<SubscriptionListData>(QUERY_KEYS.subscriptions, (old) =>
        old
          ? {
              ...old,
              subscriptions: old.subscriptions.map((s) => (s.id === data.id ? { ...s, ...data } : s)),
            }
          : old,
      );
      await invalidateAfterSubscriptionChange(qc);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.subscriptions });
      const previous = qc.getQueryData<SubscriptionListData>(QUERY_KEYS.subscriptions);
      qc.setQueryData<SubscriptionListData>(QUERY_KEYS.subscriptions, (old) =>
        old
          ? {
              ...old,
              subscriptions: old.subscriptions.filter((s) => s.id !== id),
              subscriptionCount: Math.max(0, old.subscriptionCount - 1),
              subscriptionRemaining:
                old.subscriptionRemaining == null ? null : old.subscriptionRemaining + 1,
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(QUERY_KEYS.subscriptions, ctx.previous);
      }
    },
    onSuccess: async () => {
      await invalidateAfterSubscriptionChange(qc);
    },
  });

  return { create, update, remove };
}
