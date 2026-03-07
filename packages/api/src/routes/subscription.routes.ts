import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { subscriptionController } from "../controllers/subscription.controller.js";

const router = Router();
router.use(authMiddleware);

router.get("/", (req, res) => subscriptionController.list(req as AuthRequest, res));
router.post("/", (req, res) => subscriptionController.create(req as AuthRequest, res));
router.get("/:id", (req, res) => subscriptionController.get(req as AuthRequest, res));
router.put("/:id", (req, res) => subscriptionController.update(req as AuthRequest, res));
router.delete("/:id", (req, res) => subscriptionController.delete(req as AuthRequest, res));
router.patch("/:id/pause", (req, res) => subscriptionController.pause(req as AuthRequest, res));
router.patch("/:id/resume", (req, res) => subscriptionController.resume(req as AuthRequest, res));
router.get("/:id/alternative", (req, res) => subscriptionController.getAlternative(req as AuthRequest, res));

export { router as subscriptionRoutes };
