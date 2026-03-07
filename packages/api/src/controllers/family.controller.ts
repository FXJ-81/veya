import { Response } from "express";
import { z } from "zod";
import * as familyService from "../services/family.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createSchema = z.object({ name: z.string().min(1).max(100) });
const inviteSchema = z.object({ familyId: z.string().min(1), email: z.string().email() });
export const familyController = {
  async create(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const family = await familyService.createFamily(req.user.id, parsed.data.name);
      res.status(201).json(family);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async get(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const family = await familyService.getFamily(req.params.id, req.user.id);
      if (!family) {
        res.status(404).json({ error: "Family not found" });
        return;
      }
      res.json(family);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async invite(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "familyId and email required" });
      return;
    }
    try {
      const result = await familyService.inviteMember(parsed.data.familyId, req.user.id, parsed.data.email);
      res.json(result);
    } catch (e) {
      res.status(404).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async join(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    const code = req.params.invite_code ?? (req.body as { inviteCode?: string }).inviteCode;
    if (!code) {
      res.status(400).json({ error: "Invite code required" });
      return;
    }
    try {
      const family = await familyService.joinFamily(req.user.id, code);
      res.json(family);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid invite code" });
    }
  },

  async leave(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      await familyService.leaveFamily(req.user.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async members(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const members = await familyService.getMembers(req.params.id, req.user.id);
      if (!members) {
        res.status(404).json({ error: "Family not found" });
        return;
      }
      res.json(members);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },

  async sharedSubscriptions(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) return;
    try {
      const list = await familyService.getSharedSubscriptions(req.params.id, req.user.id);
      if (!list) {
        res.status(404).json({ error: "Family not found" });
        return;
      }
      res.json(list);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
  },
};
