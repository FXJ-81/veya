"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@/types";
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import { QUERY_KEYS } from "@/lib/queryKeys";

async function fetchSubscriptions(): Promise<Subscription[]> {
  const res = await fetch("/api/subscriptions");
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
  return res.json();
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
    onSuccess: async () => {
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
    onSuccess: async () => {
      await invalidateAfterSubscriptionChange(qc);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: async () => {
      await invalidateAfterSubscriptionChange(qc);
    },
  });

  return { create, update, remove };
}
