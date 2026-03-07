import { Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../prisma/client.js";
import * as authService from "../services/auth.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  avatar: z.string().url().optional().or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const userController = {
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const user = await authService.getMe(req.user.id);
      res.json(user);
    } catch (e) {
      res.status(404).json({ error: e instanceof Error ? e.message : "Not found" });
    }
  },

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: parsed.data,
        select: { id: true, name: true, email: true, avatar: true, plan: true, createdAt: true },
      });
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async updatePassword(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      const hash = await authService.hashPassword(parsed.data.newPassword);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: hash },
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      await prisma.user.delete({ where: { id: req.user.id } });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.user.id },
      });
      res.json(settings ?? { notificationPrefs: {}, appearance: { theme: "dark" }, budgetLimit: null });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const { notificationPrefs, appearance, budgetLimit } = req.body as {
        notificationPrefs?: Record<string, unknown>;
        appearance?: Record<string, unknown>;
        budgetLimit?: number | null;
      };
      const prefs = (notificationPrefs ?? {}) as object;
      const app = (appearance ?? {}) as object;
      await prisma.userSettings.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          notificationPrefs: prefs,
          appearance: app,
          budgetLimit: budgetLimit ?? undefined,
        },
        update: {
          ...(notificationPrefs && { notificationPrefs: prefs }),
          ...(appearance && { appearance: app }),
          ...(typeof budgetLimit === "number" || budgetLimit === null ? { budgetLimit } : {}),
        },
      });
      const updated = await prisma.userSettings.findUnique({
        where: { userId: req.user.id },
      });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },
};
