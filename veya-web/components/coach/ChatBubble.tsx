"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  index: number;
  createdAt?: string;
  kind?: "chat" | "action";
  meta?: Record<string, unknown>;
}

export function ChatBubble({ role, content, index, createdAt, kind }: ChatBubbleProps) {
  const isUser = role === "user";
  const timeLabel = createdAt
    ? new Date(createdAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={isUser ? "max-w-[80%] md:max-w-[85%]" : "max-w-[85%]"}>
        <div
          className={`rounded-2xl px-3 py-3 sm:px-4 ${
            isUser
              ? "bg-accent text-white rounded-br-md"
              : kind === "action"
                ? "bg-success/15 border border-success/30 text-text-primary rounded-bl-md"
                : "bg-card/80 backdrop-blur border border-border text-text-primary rounded-bl-md"
          }`}
        >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
              components={{
                p: ({ children }) => <p className="my-2 whitespace-pre-wrap">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
                li: ({ children }) => <li className="my-0.5">{children}</li>,
                a: ({ children, ...props }) => (
                  <a className="text-accent underline underline-offset-2" {...props}>
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em]">
                    {children}
                  </code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        </div>
        {timeLabel && (
          <div
            className={`mt-1 text-[10px] text-text-tertiary sm:text-[11px] ${isUser ? "text-right" : "text-left"}`}
          >
            {timeLabel}
          </div>
        )}
      </div>
    </motion.div>
  );
}
