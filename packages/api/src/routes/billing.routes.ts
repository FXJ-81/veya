import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { billingController } from "../controllers/billing.controller.js";

const router = Router();

router.post(
  "/create-checkout-session",
  authMiddleware,
  (req, res) => billingController.createCheckoutSession(req as AuthRequest, res)
);
router.get("/subscription", authMiddleware, (req, res) => billingController.getSubscription(req as AuthRequest, res));
router.post("/cancel", authMiddleware, (req, res) => billingController.cancel(req as AuthRequest, res));

export { router as billingRoutes };
