"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";

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
  // 2FA state
  const [twoFARequired, setTwoFARequired] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendSec, setResendSec] = useState(30);
  const [resendBusy, setResendBusy] = useState(false);

  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!twoFARequired) return;
    setResendSec(30);
    resendTimer.current = setInterval(() => {
      setResendSec((s) => {
        if (s <= 1) {
          clearInterval(resendTimer.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(resendTimer.current!);
  }, [twoFARequired]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    const email = data.email.trim().toLowerCase();

    // ── Step 1: verify credentials server-side WITHOUT creating a session ──────
    console.log("[sign-in] Step 1: preflight credential check for", email);
    let preflight: { valid?: boolean; twoFactorEnabled?: boolean } = {};
    try {
      const preflightRes = await fetch("/api/auth/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: data.password }),
      });
      preflight = await preflightRes.json().catch(() => ({})) as typeof preflight;
      console.log("[sign-in] Preflight result:", preflight);
    } catch (err) {
      console.error("[sign-in] Preflight fetch error:", err);
      setError("Network error. Please try again.");
      return;
    }

    if (!preflight.valid) {
      setError("Invalid email or password");
      return;
    }

    // ── Step 2a: no 2FA — create session and redirect ─────────────────────────
    if (!preflight.twoFactorEnabled) {
      console.log("[sign-in] No 2FA required — calling signIn");
      const res = await signIn("credentials", {
        email,
        password: data.password,
        redirect: false,
      });
      console.log("[sign-in] signIn result:", { ok: res?.ok, error: res?.error });
      if (res?.error) {
        setError("Sign in failed. Please try again.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    // ── Step 2b: 2FA required — send code, show OTP screen ───────────────────
    console.log("[sign-in] 2FA required — sending code to", email);
    setPendingEmail(email);
    setPendingPassword(data.password);
    setOtpValue("");
    setOtpError("");

    try {
      const sendRes = await fetch("/api/auth/2fa/login-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const sendData = await sendRes.json().catch(() => ({})) as { success?: boolean; error?: string };
      console.log("[sign-in] login-send result:", { status: sendRes.status, ...sendData });

      if (!sendRes.ok) {
        console.error("[sign-in] login-send failed:", sendData.error);
        setError(sendData.error ?? "Failed to send verification code. Try again.");
        return;
      }
    } catch (err) {
      console.error("[sign-in] login-send fetch error:", err);
      setError("Failed to send verification code. Check your connection.");
      return;
    }

    console.log("[sign-in] Code sent — showing OTP screen");
    setTwoFARequired(true);
  };

  const resendCode = async () => {
    setResendBusy(true);
    console.log("[sign-in] Resending code to", pendingEmail);
    try {
      const res = await fetch("/api/auth/2fa/login-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
      console.log("[sign-in] Resend result:", { status: res.status, ...data });

      setResendSec(30);
      clearInterval(resendTimer.current!);
      resendTimer.current = setInterval(() => {
        setResendSec((s) => {
          if (s <= 1) { clearInterval(resendTimer.current!); return 0; }
          return s - 1;
        });
      }, 1000);
      setOtpError("");
    } catch (err) {
      console.error("[sign-in] Resend fetch error:", err);
    } finally {
      setResendBusy(false);
    }
  };

  const verifyOtp = async (code: string) => {
    if (code.length !== 6) return;
    setOtpBusy(true);
    setOtpError("");
    console.log("[sign-in] Verifying OTP for", pendingEmail);
    try {
      const verifyRes = await fetch("/api/auth/2fa/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code }),
      });
      const j = await verifyRes.json().catch(() => ({})) as { success?: boolean; error?: string };
      console.log("[sign-in] login-verify result:", { status: verifyRes.status, ...j });

      if (!verifyRes.ok || !j.success) {
        setOtpError(j.error ?? "Invalid or expired code");
        setOtpValue("");
        return;
      }

      // ── Step 3: code verified — now create the session ───────────────────
      console.log("[sign-in] OTP verified — calling signIn to create session");
      const finalRes = await signIn("credentials", {
        email: pendingEmail,
        password: pendingPassword,
        redirect: false,
      });
      console.log("[sign-in] Final signIn result:", { ok: finalRes?.ok, error: finalRes?.error });

      if (finalRes?.error) {
        setOtpError("Sign-in failed. Please try again.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("[sign-in] verifyOtp error:", err);
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleOtpComplete = (val: string) => {
    void verifyOtp(val);
  };

  if (twoFARequired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="text-xl font-bold text-text-primary">Veya</Link>
          </div>
        </nav>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 mt-16"
        >
          <h1 className="text-2xl font-bold text-text-primary text-center">Check your email</h1>
          <p className="mt-2 text-text-secondary text-center text-sm">
            We sent a 6-digit code to <span className="text-text-primary font-medium">{pendingEmail}</span>
          </p>

          <div className="mt-8">
            <OtpInput
              value={otpValue}
              onChange={setOtpValue}
              onComplete={handleOtpComplete}
              disabled={otpBusy}
              autoFocus
            />
          </div>

          <AnimatePresence>
            {otpError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-danger text-sm text-center"
              >
                {otpError}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              onClick={() => void verifyOtp(otpValue)}
              disabled={otpBusy || otpValue.length !== 6}
              isLoading={otpBusy}
            >
              Verify
            </Button>

            <button
              type="button"
              onClick={() => void resendCode()}
              disabled={resendBusy || resendSec > 0}
              className="w-full text-sm text-accent hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {resendSec > 0 ? `Resend code in ${resendSec}s` : "Resend code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setTwoFARequired(false);
                setOtpValue("");
                setOtpError("");
              }}
              className="w-full text-sm text-text-tertiary hover:text-text-secondary"
            >
              ← Back to sign in
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

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
          <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="mt-4 text-success text-sm">
            Account created! Sign in below.
          </motion.p>
        )}
        {verified && (
          <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="mt-4 text-success text-sm">
            Email verified! You can sign in now.
          </motion.p>
        )}
        {error && (
          <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="mt-4 text-danger text-sm">
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
          <Link href="/forgot-password" className="block text-sm text-accent hover:underline">
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
