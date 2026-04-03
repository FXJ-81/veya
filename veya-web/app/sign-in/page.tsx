"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

type FormData = z.infer<typeof schema>;

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const created = searchParams.get("created") === "1";
  const verified = searchParams.get("verified") === "1";
  const errorParam = searchParams.get("error");
  const errorMessage =
    errorParam === "OAuthAccountNotLinked"
      ? "This email is already registered with a password. Sign in with your email and password above."
      : errorParam
        ? decodeURIComponent(errorParam.replace(/\+/g, " "))
        : "";
  const [error, setError] = useState(errorMessage);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    const res = await signIn("credentials", {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      redirect: false,
    });
    console.log("[sign-in] signIn result:", { error: res?.error, status: res?.status, url: res?.url });
    if (res?.error) {
      const message =
        res.error === "CredentialsSignin"
          ? "Invalid email or password"
          : typeof res.error === "string"
            ? res.error
            : "Sign in failed";
      setError(message);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-text-primary">
            Veya
          </Link>
          <Link href="/sign-up" className="text-sm text-text-secondary hover:text-text-primary">
            Sign up
          </Link>
        </div>
      </nav>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 mt-16"
      >
        <h1 className="text-2xl font-bold text-text-primary">Sign in</h1>
        <p className="mt-1 text-text-secondary">Welcome back to Veya</p>
        {created && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-4 text-success text-sm"
          >
            Account created! Sign in below.
          </motion.p>
        )}
        {verified && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-4 text-success text-sm"
          >
            Email verified! You can sign in now.
          </motion.p>
        )}
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
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="mt-1 text-danger text-sm">{errors.password.message}</p>
            )}
          </div>
          <Link
            href="/forgot-password"
            className="block text-sm text-accent hover:underline"
          >
            Forgot password?
          </Link>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Sign In
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
            onClick={() => signIn("google", { callbackUrl })}
          >
            Continue with Google
          </Button>
        </div>
        <p className="mt-6 text-center text-text-secondary text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
