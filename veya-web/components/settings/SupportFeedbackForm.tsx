"use client";

/**
 * Native Support & Feedback form (Settings page).
 *
 * - Posts to `/api/support/feedback` (server validates and forwards to Google Apps Script).
 * - Client: HTML5 constraints + loading / success / error UI + short cooldown between attempts.
 * - Backup link opens the legacy Google Form in a new tab if the user prefers.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const TOPICS = [
  "Support",
  "Bug Report",
  "Billing",
  "Feature Request",
  "General Question",
] as const;

const BACKUP_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSd2gZnx95K99RCAcI7Oi9ZAwAZ0HwhgxF54xHDOTOMxlkMbGg/viewform?usp=publish-editor";

type SubmitState = "idle" | "loading" | "success" | "error";

export function SupportFeedbackForm() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("Support");
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  /** Timestamp of last finished submit attempt; used to ignore double-clicks / rapid resends. */
  const lastClientSubmitRef = useRef(0);

  // Prefill from session once signed in, without overwriting if the user already typed something.
  useEffect(() => {
    if (status !== "authenticated") return;
    setEmail((prev) => (prev.trim() ? prev : session?.user?.email ?? ""));
    setName((prev) => (prev.trim() ? prev : session?.user?.name ?? ""));
  }, [status, session?.user?.email, session?.user?.name]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitState === "loading") return;

      const now = Date.now();
      if (now - lastClientSubmitRef.current < 2200) return;

      setErrorMessage(null);
      setErrorDetails(null);
      setSubmitState("loading");

      try {
        const res = await fetch("/api/support/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim(),
            topic,
            message: message.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
          code?: string;
        };

        if (!res.ok) {
          setErrorMessage(data.error ?? "Something went wrong. Please try again.");
          setErrorDetails(typeof data.details === "string" ? data.details : null);
          setSubmitState("error");
          return;
        }

        setSubmitState("success");
        setMessage("");
      } catch {
        setErrorMessage("Network error. Check your connection and try again.");
        setErrorDetails(null);
        setSubmitState("error");
      } finally {
        // Cooldown is measured from completion so slow networks don’t block retries unfairly.
        lastClientSubmitRef.current = Date.now();
      }
    },
    [email, name, topic, message, submitState],
  );

  const busy = submitState === "loading";

  return (
    <div className="space-y-4">
      {submitState === "success" && (
        <div
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-text-primary"
          role="status"
        >
          Thank you — your message was sent. We&apos;ll get back to you if a reply is needed.
        </div>
      )}

      {submitState === "error" && errorMessage && (
        <div
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <p className="font-medium">{errorMessage}</p>
          {errorDetails ? (
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">{errorDetails}</p>
          ) : null}
        </div>
      )}

      <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-4 max-w-xl">
        <div>
          <label htmlFor="support-email" className="mb-1.5 block text-xs font-medium text-text-tertiary">
            Email <span className="text-danger">*</span>
          </label>
          <Input
            id="support-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={busy}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="support-name" className="mb-1.5 block text-xs font-medium text-text-tertiary">
            Name <span className="text-danger">*</span>
          </label>
          <Input
            id="support-name"
            type="text"
            autoComplete="name"
            required
            minLength={1}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            disabled={busy}
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="support-topic" className="mb-1.5 block text-xs font-medium text-text-tertiary">
            Topic <span className="text-danger">*</span>
          </label>
          <select
            id="support-topic"
            required
            value={topic}
            onChange={(ev) => setTopic(ev.target.value as (typeof TOPICS)[number])}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors disabled:opacity-60"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="support-message" className="mb-1.5 block text-xs font-medium text-text-tertiary">
            Problem / Message <span className="text-danger">*</span>
          </label>
          <textarea
            id="support-message"
            required
            minLength={10}
            maxLength={8000}
            rows={6}
            value={message}
            onChange={(ev) => setMessage(ev.target.value)}
            disabled={busy}
            placeholder="Describe your question, steps to reproduce a bug, or what you need help with."
            className="w-full resize-y rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-text-tertiary">{message.length} / 8000</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Sending…" : "Send message"}
          </Button>
          {submitState === "success" && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setSubmitState("idle");
                setErrorMessage(null);
                setErrorDetails(null);
                lastClientSubmitRef.current = 0;
              }}
            >
              Send another
            </Button>
          )}
        </div>
      </form>

      <p className="pt-1 text-center text-sm text-text-tertiary">
        <a
          href={BACKUP_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Open support form in a new tab
        </a>
      </p>
    </div>
  );
}
