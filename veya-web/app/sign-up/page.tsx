"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const schema = z
  .object({
    name: z.string().optional(),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const password = watch("password", "");
  const strength =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  const onSubmit = async (data: FormData) => {
    setError("");
    const registerUrl = "/api/auth/register";
    console.log("[sign-up] Submitting to", registerUrl, { email: data.email });
    try {
      const res = await fetch(registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name?.trim() || undefined,
          email: data.email.trim().toLowerCase(),
          password: data.password,
        }),
      });
      const json = await res.json().catch((parseErr) => {
        console.error("[sign-up] Response not JSON:", parseErr);
        return {};
      });
      console.log("[sign-up] API response:", { status: res.status, ok: res.ok, json });

      if (!res.ok) {
        const message =
          typeof json.error === "string"
            ? json.error
            : json.error ?? res.statusText ?? "Sign up failed";
        setError(message);
        return;
      }

      console.log("[sign-up] Account created, redirecting to sign-in");
      router.push("/sign-in?created=1"); // "Check your email to verify" is shown on sign-in
    } catch (err) {
      console.error("[sign-up] Submit error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 mt-16"
      >
        <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
        <p className="mt-1 text-text-secondary">Get started with Veya</p>
        {error && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-4 text-danger text-sm"
          >
            {error}
          </motion.p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <Input
              {...register("name")}
              placeholder="Name"
              autoComplete="name"
            />
            {errors.name && (
              <p className="mt-1 text-danger text-sm">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Input
              {...register("email")}
              type="email"
              placeholder="Email"
              autoComplete="email"
            />
            {errors.email && (
              <p className="mt-1 text-danger text-sm">{errors.email.message}</p>
            )}
          </div>
          <div>
            <Input
              {...register("password")}
              type="password"
              placeholder="Password"
              autoComplete="new-password"
            />
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded ${
                    i <= strength ? "bg-accent" : "bg-border"
                  }`}
                />
              ))}
            </div>
            {errors.password && (
              <p className="mt-1 text-danger text-sm">{errors.password.message}</p>
            )}
          </div>
          <div>
            <Input
              {...register("confirmPassword")}
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-danger text-sm">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Get Started Free
          </Button>
        </form>
        <div className="mt-6 flex items-center gap-3">
          <span className="flex-1 h-px bg-border" />
          <span className="text-text-tertiary text-sm">or</span>
          <span className="flex-1 h-px bg-border" />
        </div>
        <div className="mt-6">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Continue with Google
          </Button>
        </div>
        <p className="mt-6 text-center text-text-secondary text-sm">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
