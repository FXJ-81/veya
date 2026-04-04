"use client";

import { motion } from "framer-motion";

const PROMPTS = [
  "What can I cancel to save money?",
  "Show my subscriptions",
  "How much am I spending?",
  "What renews this week?",
  "Set budgets for all my categories",
  "Show my budget status",
  "Pause all streaming",
  "Add a subscription",
];

interface QuickPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPrompts({ onSelect, disabled }: QuickPromptsProps) {
  return (
    <div className="min-w-0">
      <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch] px-1 md:flex-wrap md:overflow-x-visible md:px-0">
        {PROMPTS.map((prompt, i) => (
          <motion.button
            key={prompt}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            type="button"
            onClick={() => onSelect(prompt)}
            disabled={disabled}
            className="min-h-[44px] shrink-0 rounded-full border border-border bg-surface px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:bg-border hover:text-text-primary disabled:opacity-50 md:min-h-0 md:px-4 md:py-2 md:text-sm"
          >
            {prompt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
