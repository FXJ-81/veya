import { Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import * as subscriptionService from "../services/subscription.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  price: z.number().positive(),
  billingCycle: z.enum(["MONTHLY", "YEARLY", "WEEKLY", "CUSTOM"]),
  startDate: z.string().transform((s) => new Date(s)),
  nextRenewal: z.string().transform((s) => new Date(s)),
  notes: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  color: z.string().optional(),
});

const updateSchema = createSchema.partial();

export const subscriptionController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { plan: true } });
      const subs = await subscriptionService.getSubscriptions(req.user.id, user?.plan ?? "FREE");
      res.json(subs);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to list subscriptions" });
    }
  },

  async get(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const id = req.params.id;
    try {
      const sub = await subscriptionService.getSubscriptionById(id, req.user.id);
      if (!sub) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }
      res.json(sub);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to get subscription" });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    try {
      const sub = await subscriptionService.createSubscription(req.user.id, parsed.data);
      res.status(201).json(sub);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create";
      res.status(400).json({ error: msg });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const sub = await subscriptionService.updateSubscription(req.params.id, req.user.id, parsed.data);
      res.json(sub);
    } catch (e) {
      if ((e as { code?: string })?.code === "P2025") {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to update" });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      await subscriptionService.deleteSubscription(req.params.id, req.user.id);
      res.status(204).send();
    } catch (e) {
      if ((e as { code?: string })?.code === "P2025") {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to delete" });
    }
  },

  async pause(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const sub = await subscriptionService.pauseSubscription(req.params.id, req.user.id);
      res.json(sub);
    } catch (e) {
      if ((e as { code?: string })?.code === "P2025") {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to pause" });
    }
  },

  async resume(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const sub = await subscriptionService.resumeSubscription(req.params.id, req.user.id);
      res.json(sub);
    } catch (e) {
      if ((e as { code?: string })?.code === "P2025") {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to resume" });
    }
  },

  async getAlternative(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const alt = await subscriptionService.getAlternative(req.params.id, req.user.id);
      res.json(alt ?? {});
    } catch {
      res.status(500).json({ error: "Failed to get alternative" });
    }
  },
};
