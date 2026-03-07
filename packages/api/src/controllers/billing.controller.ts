import express from "express";
import { Response } from "express";
import Stripe from "stripe";
import { prisma } from "../prisma/client.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export const billingController = {
  async createCheckoutSession(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const interval = (req.body as { interval?: string }).interval ?? "month";
    const priceId =
      interval === "year"
        ? process.env.STRIPE_PREMIUM_PRICE_YEARLY
        : process.env.STRIPE_PREMIUM_PRICE_MONTHLY;
    if (!priceId) {
      res.status(500).json({ error: "Billing not configured" });
      return;
    }
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.WEB_URL ?? "http://localhost:3000"}/dashboard?upgraded=1`,
        cancel_url: `${process.env.WEB_URL ?? "http://localhost:3000"}/dashboard`,
        client_reference_id: req.user.id,
        subscription_data: { trial_period_days: 7 },
      });
      res.json({ url: session.url, sessionId: session.id });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to create checkout" });
    }
  },

  async webhook(req: express.Request, res: Response): Promise<void> {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || !sig) {
      res.status(400).send("Webhook secret missing");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer | string, sig, webhookSecret);
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : "Unknown"}`);
      return;
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id as string;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: "PREMIUM" },
        });
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const ref = sub.metadata?.userId;
      if (ref) {
        await prisma.user.update({
          where: { id: ref },
          data: { plan: "FREE" },
        });
      }
    }
    res.json({ received: true });
  },

  async getSubscription(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { plan: true },
      });
      res.json({ plan: user?.plan ?? "FREE" });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async cancel(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    res.json({ message: "Cancel at end of billing period. Contact support to cancel immediately." });
  },
};
