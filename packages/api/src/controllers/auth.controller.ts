import { Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const authController = {
  async register(req: { body: unknown }, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const { name, email, password } = parsed.data;
    try {
      const result = await authService.register({ name, email, password });
      res.status(201).json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      res.status(400).json({ error: msg });
    }
  },

  async login(req: { body: unknown }, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    try {
      const result = await authService.login(parsed.data);
      res.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      res.status(401).json({ error: msg });
    }
  },

  async refresh(req: { body: unknown }, res: Response): Promise<void> {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const { userId, email } = authService.verifyRefreshToken(parsed.data.refreshToken);
      const accessToken = authService.signAccessToken(userId, email);
      const expiresIn = 15 * 60;
      res.json({ accessToken, expiresIn });
    } catch {
      res.status(401).json({ error: "Invalid or expired refresh token" });
    }
  },

  async forgotPassword(req: { body: unknown }, res: Response): Promise<void> {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    res.json({ message: "If an account exists, you will receive a reset link." });
  },

  async resetPassword(req: { body: unknown }, res: Response): Promise<void> {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    res.json({ message: "Password has been reset." });
  },

  async me(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const user = await authService.getMe(req.user.id);
      res.json(user);
    } catch {
      res.status(404).json({ error: "User not found" });
    }
  },
};
