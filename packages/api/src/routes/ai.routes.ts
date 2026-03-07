import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { aiController } from "../controllers/ai.controller.js";

const router = Router();
router.use(authMiddleware);

router.post("/chat", (req, res) => aiController.chat(req as AuthRequest, res));
router.get("/conversations", (req, res) => aiController.conversations(req as AuthRequest, res));
router.delete("/conversations", (req, res) => aiController.deleteConversations(req as AuthRequest, res));
router.get("/daily-tip", (req, res) => aiController.dailyTip(req as AuthRequest, res));

export { router as aiRoutes };
