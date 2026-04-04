"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen min-w-0 items-center justify-center bg-background p-4 sm:p-6">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl min-w-0 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold text-text-primary">
            Veya
          </Link>
          <Link href="/sign-in" className="text-sm text-text-secondary hover:text-text-primary">
            Sign in
          </Link>
        </div>
      </nav>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-16 w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8"
      >
        <h1 className="text-2xl font-bold text-text-primary">Forgot password?</h1>
        <p className="mt-1 text-text-secondary">
          Enter your email and we&apos;ll send a reset link.
        </p>
        {sent ? (
          <p className="mt-6 text-text-secondary text-sm">
            If an account exists for that email, we&apos;ve sent a reset link.
            Check your inbox and use the link within 1 hour.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" className="w-full" isLoading={loading}>
              Send reset link
            </Button>
          </form>
        )}
        <Link
          href="/sign-in"
          className="mt-6 block text-center text-accent hover:underline text-sm"
        >
          Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
