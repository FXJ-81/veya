import { Response } from "express";
import * as notificationsService from "../services/notifications.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const notificationController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const list = await notificationsService.getNotifications(req.user.id);
      res.json(list);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async markRead(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      await notificationsService.markRead(req.params.id, req.user.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async markAllRead(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      await notificationsService.markAllRead(req.user.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const settings = await notificationsService.getSettings(req.user.id);
      res.json(settings);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const settings = await notificationsService.updateSettings(req.user.id, req.body as Record<string, unknown>);
      res.json(settings);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },
};
