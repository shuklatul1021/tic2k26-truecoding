import fs from "fs";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import router from "./routes/index.js";

const app = express();

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    logger.info(
      {
        method: req.method,
        url: req.originalUrl.split("?")[0],
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      "HTTP request",
    );
  });

  next();
});

app.use(
  cors({
    origin:
      env.corsOrigin === "*"
        ? true
        : env.corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean),
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use("/api/uploads", express.static(env.uploadDir));
app.use("/api", router);

export default app;
