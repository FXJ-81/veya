"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className="flex min-w-0 items-end gap-2 rounded-xl border border-border bg-card p-2">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Ask Veya AI..."
        rows={1}
        className="min-h-[48px] min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-base text-text-primary placeholder-text-tertiary focus:outline-none sm:min-h-[44px] sm:py-2 sm:text-sm"
        disabled={disabled}
      />
      <Button
        size="md"
        className="shrink-0"
        onClick={handleSubmit}
        disabled={!value.trim() || disabled}
      >
        Send
      </Button>
    </div>
  );
}
