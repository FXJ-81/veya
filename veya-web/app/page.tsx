"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { motion } from "framer-motion";

const FEATURES = [
  {
    title: "Track Everything",
    desc: "Connect accounts or add manually. We find and track every subscription in one place.",
    icon: "📋",
  },
  {
    title: "Cancel Unused",
    desc: "We identify unused subs and help you negotiate better rates or cancel with one tap.",
    icon: "💰",
  },
  {
    title: "Find Alternatives",
    desc: "See cheaper alternatives for each subscription and how much you could save.",
    icon: "🔍",
  },
  {
    title: "Smart insights",
    desc: "See where your money goes and get alerts before renewals sneak up on you.",
    icon: "📊",
  },
  {
    title: "AI Coach",
    desc: "Get personalized tips and answers based on your real subscription data.",
    icon: "🤖",
  },
  {
    title: "Smart Alerts",
    desc: "Renewal reminders, price changes, and spending alerts so nothing surprises you.",
    icon: "🔔",
  },
];

const FAQ = [
  { q: "How do I add my subscriptions?", a: "Sign up, then add each subscription manually with name, price, and billing cycle. Bank linking (Premium) can auto-detect some." },
  { q: "Is my data secure?", a: "Yes. We use encryption and never sell your data. Passwords are hashed with bcrypt." },
  { q: "Can I cancel Premium anytime?", a: "Yes. Cancel before your next billing date and you keep access until the period ends." },
  { q: "What's the AI coach?", a: "An AI that sees your subscription data and gives specific, actionable advice to save money." },
  { q: "Does Veya work with my bank?", a: "Premium supports bank linking to help find subscriptions. We're adding more banks over time." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-background">
      <Navbar />
      <section className="relative overflow-x-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl"
          >
            Take control of your subscriptions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-base text-text-secondary sm:text-lg"
          >
            Track, cancel, and save — powered by AI
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 flex w-full min-w-0 flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <Link
              href="/sign-up"
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-lg shadow-accent/25 hover:opacity-90 sm:w-auto sm:px-8 sm:py-4"
            >
              Get Started Free
            </Link>
            <a
              href="#features"
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border bg-surface px-6 py-3 text-base font-semibold text-text-primary sm:w-auto sm:px-8 sm:py-4"
            >
              See how it works
            </a>
          </motion.div>
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/5 to-transparent" />
      </section>

      <section id="features" className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl min-w-0">
          <h2 className="mb-4 text-center text-2xl font-bold text-text-primary sm:text-3xl">
            Everything you need to take control
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-text-secondary sm:mb-16 sm:text-base">
            Veya brings subscriptions, spending insights, and an AI coach into one app.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-6"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="text-xl font-semibold text-text-primary mt-4">
                  {f.title}
                </h3>
                <p className="mt-2 text-text-secondary">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl min-w-0">
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary sm:mb-12 sm:text-3xl">
            Simple pricing
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-border bg-card p-8"
            >
              <h3 className="text-xl font-bold text-text-primary">Free</h3>
              <p className="mt-2 font-mono text-4xl font-bold text-text-primary font-mono-nums">
                $0
              </p>
              <p className="text-text-secondary text-sm">forever</p>
              <ul className="mt-6 space-y-3 text-text-secondary text-sm">
                <li>Up to 10 subscriptions</li>
                <li>Basic analytics</li>
                <li>1 AI message per day</li>
                <li>Renewal reminders</li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-8 block w-full rounded-xl border border-border py-3 text-center font-semibold text-text-primary hover:bg-surface"
              >
                Get Started Free
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border-2 border-accent bg-card p-8 relative"
            >
              <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-white">
                Popular
              </span>
              <h3 className="text-xl font-bold text-text-primary">Premium</h3>
              <p className="mt-2 font-mono text-4xl font-bold text-accent font-mono-nums">
                $4.99
              </p>
              <p className="text-text-secondary text-sm">/month</p>
              <ul className="mt-6 space-y-3 text-text-secondary text-sm">
                <li>Unlimited subscriptions</li>
                <li>Full analytics & insights</li>
                <li>Unlimited AI coach</li>
                <li>Export-ready summaries</li>
                <li>Bank linking</li>
                <li>7-day free trial</li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-8 block w-full rounded-xl bg-accent py-3 text-center font-semibold text-white hover:opacity-90"
              >
                Start free trial
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl min-w-0">
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary sm:mb-12 sm:text-3xl">
            FAQ
          </h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <motion.details
                key={item.q}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-4 group"
              >
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 font-semibold text-text-primary">
                  {item.q}
                  <span className="text-text-tertiary group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="mt-1 text-sm text-text-secondary">{item.a}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto flex max-w-6xl min-w-0 flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-text-secondary text-sm">© Veya. Your money. Your rules.</span>
          <div className="flex gap-6">
            <Link href="/sign-in" className="text-sm text-text-secondary hover:text-text-primary">
              Sign in
            </Link>
            <Link href="/sign-up" className="text-sm text-accent hover:underline">
              Get Started Free
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
