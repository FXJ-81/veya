"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/types";
import { formatNotificationTimeAgo } from "@/lib/notificationTime";
import { notificationIconForType } from "@/lib/notificationIcon";
import { AppIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";

async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await fetch("/api/notifications");
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as NotificationItem[]) : [];
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const list = await fetchNotifications();
    setItems(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await fetch("/api/notifications/generate", { method: "POST" });
      } catch {
        /* non-fatal */
      }
      if (cancelled) return;
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    await refresh();
  };

  const markOneRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refresh();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-text-secondary outline-none transition-colors hover:border-border hover:bg-background-secondary/80 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <AppIcons.bell className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
        {unreadCount > 0 ? (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] translate-x-px items-center justify-center rounded-full border-2 border-card bg-red-600 px-1 text-[10px] font-semibold tabular-nums leading-none text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-card shadow-lg"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-accent hover:underline disabled:pointer-events-none disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-text-tertiary">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-text-secondary">
                You&apos;re all caught up. No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) void markOneRead(n.id);
                      }}
                      className={cn(
                        "flex w-full gap-3 border-l-4 py-3 pl-2 pr-3 text-left transition-colors hover:bg-background-secondary/80",
                        n.read ? "border-transparent" : "border-accent",
                      )}
                    >
                      <span className="flex shrink-0 items-center justify-center text-text-tertiary" aria-hidden>
                        {notificationIconForType(n.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary">{n.title}</p>
                        {n.body ? (
                          <p className="mt-0.5 text-xs text-text-secondary">{n.body}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-text-tertiary">
                          {formatNotificationTimeAgo(n.sentAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
