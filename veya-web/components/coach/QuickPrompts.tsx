"use client";

import { motion } from "framer-motion";

const PROMPTS = [
  "What can I cancel?",
  "Show my biggest waste",
  "How do I save $50/month?",
  "What renews this week?",
];

interface QuickPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPrompts({ onSelect, disabled }: QuickPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROMPTS.map((prompt, i) => (
        <motion.button
          key={prompt}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          onClick={() => onSelect(prompt)}
          disabled={disabled}
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-border hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {prompt}
        </motion.button>
      ))}
    </div>
  );
}
