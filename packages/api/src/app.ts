import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import { ZodError } from "zod";

import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import adminRouter from "./routes/admin.js";
import publicRouter from "./routes/public.js";
import repRouter from "./routes/rep.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(hpp());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (config.corsOrigins.includes(origin)) return cb(null, true);
        if (config.nodeEnv === "development") return cb(null, true);
        return cb(null, false);
      },
      credentials: false,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);

  const ownerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "burqan-api" });
  });

  app.use("/uploads", express.static(config.uploadDir, { index: false, maxAge: "7d" }));

  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/rep", repRouter);
  app.use("/api/v1/public", ownerLimiter, publicRouter);

  app.use(notFoundHandler);
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "خطأ في البيانات المرسلة", details: err.flatten() });
    }
    return errorHandler(err, req, res, next);
  });

  return app;
}
