import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { analyticsController } from "../controllers/analytics.controller.js";

const router = Router();
router.use(authMiddleware);

router.get("/summary", (req, res) => analyticsController.summary(req as AuthRequest, res));
router.get("/history", (req, res) => analyticsController.history(req as AuthRequest, res));
router.get("/categories", (req, res) => analyticsController.categories(req as AuthRequest, res));
router.get("/score", (req, res) => analyticsController.score(req as AuthRequest, res));
router.get("/insights", (req, res) => analyticsController.insights(req as AuthRequest, res));
router.get("/heatmap", (req, res) => analyticsController.heatmap(req as AuthRequest, res));

export { router as analyticsRoutes };
