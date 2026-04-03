"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  // Tracks which box is visually "active"
  const [focused, setFocused] = useState<number | null>(autoFocus ? 0 : null);

  // Sync internal refs array length
  useEffect(() => {
    inputsRef.current = inputsRef.current.slice(0, length);
  }, [length]);

  useEffect(() => {
    if (autoFocus) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus]);

  const focusIndex = useCallback((i: number) => {
    const el = inputsRef.current[Math.max(0, Math.min(i, length - 1))];
    el?.focus();
  }, [length]);

  const handleChange = (i: number, raw: string) => {
    // Accept only digits
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    // If user pastes a full code
    if (digits.length > 1) {
      const next = (value.slice(0, i) + digits).slice(0, length);
      onChange(next);
      const nextFocus = Math.min(next.length, length - 1);
      focusIndex(nextFocus);
      if (next.length === length) onComplete?.(next);
      return;
    }

    const arr = value.padEnd(length, " ").split("");
    arr[i] = digits[0];
    const next = arr.join("").trimEnd().slice(0, length);
    onChange(next);

    if (i < length - 1) {
      focusIndex(i + 1);
    }
    if (next.replace(/ /g, "").length === length) {
      onComplete?.(next.replace(/ /g, ""));
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i] && value[i] !== " ") {
        // Clear current
        const arr = value.padEnd(length, " ").split("");
        arr[i] = " ";
        onChange(arr.join("").trimEnd().slice(0, length));
      } else if (i > 0) {
        // Move back and clear previous
        const arr = value.padEnd(length, " ").split("");
        arr[i - 1] = " ";
        onChange(arr.join("").trimEnd().slice(0, length));
        focusIndex(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusIndex(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusIndex(i + 1);
    } else if (e.key === "Delete") {
      e.preventDefault();
      const arr = value.padEnd(length, " ").split("");
      arr[i] = " ";
      onChange(arr.join("").trimEnd().slice(0, length));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const nextFocus = Math.min(pasted.length, length - 1);
    focusIndex(nextFocus);
    if (pasted.length === length) onComplete?.(pasted);
  };

  return (
    <div className="flex gap-3 justify-center" aria-label="One-time code input">
      {Array.from({ length }).map((_, i) => {
        const digit = value[i] ?? "";
        const isFocused = focused === i;

        return (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={2}
            value={digit}
            disabled={disabled}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(null)}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              "h-14 w-12 rounded-xl border text-center text-2xl font-bold tracking-widest text-text-primary",
              "bg-surface transition-all focus:outline-none caret-transparent",
              isFocused
                ? "border-accent ring-2 ring-accent/30"
                : digit
                  ? "border-border/80"
                  : "border-border/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
        );
      })}
    </div>
  );
}
