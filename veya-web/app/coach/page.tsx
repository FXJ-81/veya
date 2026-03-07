"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatBubble } from "@/components/coach/ChatBubble";
import { ChatInput } from "@/components/coach/ChatInput";
import { QuickPrompts } from "@/components/coach/QuickPrompts";
import type { AIMessage } from "@/types";

export default function CoachPage() {
  const { status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/sign-in");
  }, [status, router]);

  const sendMessage = async (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
    setLoading(true);
    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.reply },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            e instanceof Error ? e.message : "Something went wrong. Try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-56 pr-6 py-8 flex flex-col h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-text-primary">
            Veya AI Coach
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Ask anything about your subscriptions. I have full context.
          </p>
        </motion.div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <p className="text-text-tertiary text-sm">
                Try a quick prompt or type your own question.
              </p>
              <QuickPrompts onSelect={sendMessage} disabled={loading} />
            </motion.div>
          )}
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} index={i} />
          ))}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="rounded-2xl rounded-bl-md border border-border bg-card/80 px-4 py-3">
                <span className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          {messages.length > 0 && (
            <div className="mb-3">
              <QuickPrompts onSelect={sendMessage} disabled={loading} />
            </div>
          )}
          <ChatInput onSend={sendMessage} disabled={loading} />
        </div>
      </main>
    </div>
  );
}
