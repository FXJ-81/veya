import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { userController } from "../controllers/user.controller.js";

const router = Router();
router.use(authMiddleware);

router.get("/profile", (req, res) => userController.getProfile(req as AuthRequest, res));
router.put("/profile", (req, res) => userController.updateProfile(req as AuthRequest, res));
router.put("/password", (req, res) => userController.updatePassword(req as AuthRequest, res));
router.delete("/account", (req, res) => userController.deleteAccount(req as AuthRequest, res));
router.get("/settings", (req, res) => userController.getSettings(req as AuthRequest, res));
router.put("/settings", (req, res) => userController.updateSettings(req as AuthRequest, res));

export { router as userRoutes };
