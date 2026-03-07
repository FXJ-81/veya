import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { notificationController } from "../controllers/notification.controller.js";

const router = Router();
router.use(authMiddleware);

router.get("/", (req, res) => notificationController.list(req as AuthRequest, res));
router.patch("/:id/read", (req, res) => notificationController.markRead(req as AuthRequest, res));
router.patch("/read-all", (req, res) => notificationController.markAllRead(req as AuthRequest, res));
router.get("/settings", (req, res) => notificationController.getSettings(req as AuthRequest, res));
router.put("/settings", (req, res) => notificationController.updateSettings(req as AuthRequest, res));

export { router as notificationRoutes };
