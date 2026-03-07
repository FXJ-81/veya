import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRoutes } from "./routes/auth.routes.js";
import { subscriptionRoutes } from "./routes/subscription.routes.js";
import { analyticsRoutes } from "./routes/analytics.routes.js";
import { aiRoutes } from "./routes/ai.routes.js";
import { familyRoutes } from "./routes/family.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { billingRoutes } from "./routes/billing.routes.js";
import { billingController } from "./controllers/billing.controller.js";
import { logger } from "./utils/logger.js";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  })
);
app.use(morgan("combined", { stream: { write: (m) => logger.info(m.trim()) } }));

app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  (req: express.Request, res: express.Response) => billingController.webhook(req, res)
);
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "veya-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/family", familyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/user", userRoutes);
app.use("/api/billing", billingRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`Veya API running on port ${PORT}`);
});
