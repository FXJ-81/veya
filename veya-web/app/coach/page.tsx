"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { ChatBubble } from "@/components/coach/ChatBubble";
import { ChatInput } from "@/components/coach/ChatInput";
import { QuickPrompts } from "@/components/coach/QuickPrompts";
import { invalidateAfterSubscriptionChange } from "@/lib/invalidateSubscriptionQueries";
import type { AIMessage } from "@/types";

type ConversationListItem = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

// Strip any raw {"action":...} JSON blocks from assistant message text so they
// never appear as visible text in the chat — actions are executed server-side.
function stripJsonActions(text: string): string {
  let result = text;
  while (true) {
    const start = result.indexOf('{"action"');
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < result.length; i++) {
      if (result[i] === "{") depth++;
      else if (result[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) break;
    result = (result.slice(0, start) + result.slice(end + 1)).trim();
  }
  return result;
}

function cleanMessages(msgs: AIMessage[]): AIMessage[] {
  return msgs.map((m) =>
    m.role === "assistant" && m.kind !== "action"
      ? { ...m, content: stripJsonActions(m.content ?? "") }
      : m
  );
}

function truncateTitle(value: string, max = 35): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(date).getTime();
  const diff = Math.round((today - target) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupLabel(value: string): "Today" | "Yesterday" | "This week" | "Older" {
  const date = new Date(value);
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(date).getTime();
  const diff = Math.round((today - target) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= 6) return "This week";
  return "Older";
}

export default function CoachPage() {
  const { status } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const groupedConversations = useMemo(() => {
    const groups: Record<"Today" | "Yesterday" | "This week" | "Older", ConversationListItem[]> = {
      Today: [],
      Yesterday: [],
      "This week": [],
      Older: [],
    };
    for (const convo of conversations) {
      groups[groupLabel(convo.updatedAt || convo.createdAt)].push(convo);
    }
    return groups;
  }, [conversations]);

  const loadConversation = async (conversationId: string) => {
    const res = await fetch(`/api/ai/conversations/${conversationId}`);
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    const convo = json?.conversation;
    if (!convo) return false;
    setActiveConversationId(conversationId);
    setMessages(cleanMessages(Array.isArray(convo.messages) ? convo.messages : []));
    return true;
  };

  const enrichConversationTitles = async (items: ConversationListItem[]) => {
    const withTitles = await Promise.all(
      items.map(async (item) => {
        if (item.title?.trim()) return item;
        const res = await fetch(`/api/ai/conversations/${item.id}`);
        if (!res.ok) return item;
        const json = await res.json().catch(() => null);
        const msgs = (json?.conversation?.messages as AIMessage[] | undefined) ?? [];
        const firstUser = msgs.find((m) => m.role === "user" && m.content?.trim());
        return { ...item, title: firstUser?.content?.trim() ?? "New chat" };
      })
    );
    setConversations(withTitles);
    return withTitles;
  };

  const refreshConversations = async () => {
    const listRes = await fetch("/api/ai/conversations");
    if (!listRes.ok) return [] as ConversationListItem[];
    const listJson = await listRes.json().catch(() => null);
    const list = ((listJson?.conversations as ConversationListItem[]) ?? []).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return enrichConversationTitles(list);
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  // Every visit to /coach starts a brand-new empty (unsaved) chat.
  useEffect(() => {
    if (status !== "authenticated") return;
    setMessages([]);
    setActiveConversationId(null);
    setHistoryOpen(false);
  }, [status]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, loading]);

  useEffect(() => {
    if (!historyOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const el = historyRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [historyOpen]);

  // Do NOT load old messages on page load. History is accessible via dropdown only.

  const sendMessage = async (content: string) => {
    let conversationId = activeConversationId;
    if (!conversationId) {
      const createRes = await fetch("/api/ai/conversations", { method: "POST" }).catch(() => null);
      const createJson = await createRes?.json().catch(() => null);
      const created = createJson?.conversation as ConversationListItem | undefined;
      if (created?.id) {
        conversationId = created.id;
        setActiveConversationId(created.id);
        setConversations((prev) => [created, ...prev]);
      }
    }

    const optimistic: AIMessage = {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLoading(true);
    try {
      const payload: { message: string; conversationId?: string } = { message: content };
      if (conversationId) payload.conversationId = conversationId;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      if (json.actionPerformed) {
        await invalidateAfterSubscriptionChange(qc);
      }
      if (Array.isArray(json.messages)) {
        setMessages(cleanMessages(json.messages));
        // Keep dropdown in sync after messages are saved.
        await refreshConversations();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: stripJsonActions(json.reply ?? ""),
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            e instanceof Error ? e.message : "Something went wrong. Try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/conversations/${activeConversationId}/clear`, { method: "POST" });
      if (res.ok) {
        setMessages([]);
        await refreshConversations();
      }
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async () => {
    // New Chat should start a fresh empty chat without creating a DB row until first message.
    setActiveConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
  };

  const deleteConversation = async (conversationId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}`, { method: "DELETE" });
      if (!res.ok) return;
      const list = await refreshConversations();
      if (conversationId === activeConversationId) {
        const next = list.find((c) => c.id !== conversationId);
        if (next) {
          await loadConversation(next.id);
        } else {
          const createdRes = await fetch("/api/ai/conversations", { method: "POST" });
          const createdJson = await createdRes.json().catch(() => null);
          const created = createdJson?.conversation as ConversationListItem | undefined;
          if (created?.id) {
            setConversations([created]);
            setActiveConversationId(created.id);
            setMessages([]);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  return (
    <AppShell variant="coach">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/30 max-md:rounded-xl lg:rounded-3xl">
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="shrink-0 border-b border-border/60 px-3 pb-3 pt-2 sm:px-5 sm:pb-4 sm:pt-3 lg:px-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-text-primary md:text-xl lg:text-2xl">
                Veya AI Coach
              </h1>
              <p className="mt-1 hidden text-sm text-text-secondary md:block">
                Ask anything about your subscriptions. I have full context.
              </p>
            </div>
            <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch] sm:gap-2">
              <div ref={historyRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const next = !historyOpen;
                    setHistoryOpen(next);
                    if (next) {
                      await refreshConversations();
                    }
                  }}
                  disabled={loading}
                  className="min-h-[44px] shrink-0 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-border hover:text-text-primary disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  <span className="md:hidden">History</span>
                  <span className="hidden md:inline">Chat History</span>
                </button>
                <AnimatePresence>
                  {historyOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border z-50"
                      style={{ background: "#111118", borderColor: "#2a2a3a" }}
                    >
                      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#2a2a3a" }}>
                        <span className="text-sm font-semibold text-text-primary">Previous Chats</span>
                        <button
                          onClick={createNewChat}
                          className="rounded-md bg-accent px-2.5 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          New Chat
                        </button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto p-2">
                        {conversations.length === 0 ? (
                          <div className="px-3 py-8 text-center text-sm text-text-tertiary">No previous chats.</div>
                        ) : (
                          (["Today", "Yesterday", "This week", "Older"] as const).map((group) => {
                            const items = groupedConversations[group];
                            if (!items.length) return null;
                            return (
                              <div key={group} className="mb-2">
                                <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-text-tertiary">
                                  {group}
                                </div>
                                <div className="space-y-1">
                                  {items.map((convo) => (
                                    <button
                                      key={convo.id}
                                      onClick={async () => {
                                        setHistoryOpen(false);
                                        await loadConversation(convo.id);
                                      }}
                                      className={`group w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                                        convo.id === activeConversationId
                                          ? "border-accent/50 bg-accent/20"
                                          : "border-transparent hover:border-border hover:bg-surface"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm text-text-primary">
                                          {truncateTitle(convo.title || "New chat", 35)}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[11px] text-text-tertiary">
                                            {formatDateLabel(convo.updatedAt || convo.createdAt)}
                                          </span>
                                          <span
                                            className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-opacity"
                                            onClick={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              void deleteConversation(convo.id);
                                            }}
                                            title="Delete conversation"
                                            role="button"
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                              <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                              <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                              <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                              <path d="M6 7L7 20H17L18 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                              <path d="M9 7V4H15V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={clearChat}
                disabled={loading || messages.length === 0}
                className="min-h-[44px] shrink-0 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-border hover:text-text-primary disabled:opacity-50 sm:px-3 sm:text-sm"
              >
                <span className="md:hidden">Clear</span>
                <span className="hidden md:inline">Clear chat</span>
              </button>
            </div>
          </div>
        </motion.header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 max-md:pb-[min(42vh,13rem)] sm:px-5 sm:py-4 lg:px-6">
            <div className="w-full min-w-0 space-y-3 sm:space-y-4">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-text-tertiary">
                    Try a quick prompt or type your own question below.
                  </p>
                  <QuickPrompts onSelect={sendMessage} disabled={loading} />
                </motion.div>
              )}
              {messages.map((m, i) => (
                <ChatBubble
                  key={m.id ?? i}
                  role={m.role}
                  content={m.content}
                  createdAt={m.createdAt}
                  kind={m.kind}
                  meta={m.meta as any}
                  index={i}
                />
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card/80 px-3 py-3 sm:px-4">
                    <span className="flex gap-1">
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div
            className="z-[58] shrink-0 border-t border-border/80 bg-card/95 px-3 pb-3 pt-3 backdrop-blur-xl max-md:fixed max-md:left-6 max-md:right-6 max-md:rounded-t-2xl max-md:border-x max-md:border-t max-md:border-border/80 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] max-md:shadow-lg max-md:[bottom:calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px))] sm:bg-card/40 sm:px-5 sm:pb-4 sm:pt-4 lg:px-6"
          >
            <div className="w-full min-w-0 space-y-2 sm:space-y-3">
              {messages.length > 0 && (
                <QuickPrompts onSelect={sendMessage} disabled={loading} />
              )}
              <ChatInput onSend={sendMessage} disabled={loading} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
