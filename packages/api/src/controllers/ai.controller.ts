import { Response } from "express";
import { z } from "zod";
import * as aiService from "../services/ai.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const chatSchema = z.object({ message: z.string().min(1).max(2000) });

export const aiController = {
  async chat(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Message required" });
      return;
    }
    try {
      const reply = await aiService.chat(req.user.id, parsed.data.message);
      res.json({ reply });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "AI service error" });
    }
  },

  async conversations(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const list = await aiService.getConversations(req.user.id);
      res.json(list);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async deleteConversations(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      await aiService.deleteConversations(req.user.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async dailyTip(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const tip = await aiService.getDailyTip(req.user.id);
      res.json({ tip });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },
};
