"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@/types";

async function fetchSubscriptions(): Promise<Subscription[]> {
  const res = await fetch("/api/subscriptions");
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
  return res.json();
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: fetchSubscriptions,
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
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
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
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return { create, update, remove };
}
