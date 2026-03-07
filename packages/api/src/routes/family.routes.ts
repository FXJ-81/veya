import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { familyController } from "../controllers/family.controller.js";

const router = Router();
router.use(authMiddleware);

router.post("/create", (req, res) => familyController.create(req as AuthRequest, res));
router.post("/invite", (req, res) => familyController.invite(req as AuthRequest, res));
router.post("/join/:invite_code", (req, res) => familyController.join(req as AuthRequest, res));
router.delete("/leave", (req, res) => familyController.leave(req as AuthRequest, res));
router.get("/:id", (req, res) => familyController.get(req as AuthRequest, res));
router.get("/:id/members", (req, res) => familyController.members(req as AuthRequest, res));
router.get("/:id/shared-subscriptions", (req, res) => familyController.sharedSubscriptions(req as AuthRequest, res));

export { router as familyRoutes };
