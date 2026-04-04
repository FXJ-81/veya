"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!token) {
      setError("Invalid reset link. Use the link from your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen min-w-0 items-center justify-center bg-background p-4 sm:p-6">
        <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl min-w-0 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="text-xl font-bold text-text-primary">Veya</Link>
            <Link href="/sign-in" className="text-sm text-text-secondary hover:text-text-primary">Sign in</Link>
          </div>
        </nav>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8"
        >
          <h1 className="text-2xl font-bold text-text-primary">Invalid link</h1>
          <p className="mt-2 text-text-secondary text-sm">Use the reset link from your email, or request a new one.</p>
          <Link href="/forgot-password" className="mt-6 inline-block text-accent hover:underline text-sm">Request new link</Link>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen min-w-0 items-center justify-center bg-background p-4 sm:p-6">
        <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl min-w-0 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="text-xl font-bold text-text-primary">Veya</Link>
            <Link href="/sign-in" className="text-sm text-text-secondary hover:text-text-primary">Sign in</Link>
          </div>
        </nav>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8"
        >
          <h1 className="text-2xl font-bold text-success">Password updated</h1>
          <p className="mt-2 text-text-secondary text-sm">Redirecting you to sign in...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-w-0 items-center justify-center bg-background p-4 sm:p-6">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl min-w-0 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold text-text-primary">Veya</Link>
          <Link href="/sign-in" className="text-sm text-text-secondary hover:text-text-primary">Sign in</Link>
        </div>
      </nav>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-16 w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8"
      >
        <h1 className="text-2xl font-bold text-text-primary">Set new password</h1>
        <p className="mt-1 text-text-secondary text-sm">Enter your new password below.</p>
        {error && <p className="mt-4 text-danger text-sm">{error}</p>}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            type="password"
            placeholder="New password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" className="w-full" isLoading={loading}>
            Reset password
          </Button>
        </form>
        <Link href="/sign-in" className="mt-6 block text-center text-accent hover:underline text-sm">
          Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
