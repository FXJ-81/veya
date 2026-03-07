import { Response } from "express";
import * as analyticsService from "../services/analytics.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const analyticsController = {
  async summary(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const data = await analyticsService.getSummary(req.user.id);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async history(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const data = await analyticsService.getHistory(req.user.id);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async categories(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const data = await analyticsService.getCategories(req.user.id);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async score(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const data = await analyticsService.getScore(req.user.id);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async insights(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const data = await analyticsService.getInsights(req.user.id);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async heatmap(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    try {
      const data = await analyticsService.getHeatmap(req.user.id, year);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },
};
