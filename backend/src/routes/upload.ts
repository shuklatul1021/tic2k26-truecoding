import fs from "fs";
import path from "path";
import { Router } from "express";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

function ensureUploadDir() {
  if (!fs.existsSync(env.uploadDir)) {
    fs.mkdirSync(env.uploadDir, { recursive: true });
  }
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body as {
      base64Image?: string;
      mimeType?: string;
    };

    if (!base64Image?.trim() || !mimeType?.trim()) {
      res.status(400).json({
        error: "BadRequest",
        message: "base64Image and mimeType are required",
      });
      return;
    }

    ensureUploadDir();

    const cleanedBase64 = base64Image.includes(",")
      ? base64Image.split(",").pop() || ""
      : base64Image;

    const ext = mimeType.split("/")[1] || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const filepath = path.join(env.uploadDir, filename);

    fs.writeFileSync(filepath, Buffer.from(cleanedBase64, "base64"));

    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol =
      (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)
        ?.split(",")[0]
        ?.trim() || req.protocol;
    const host = req.get("host") || `localhost:${env.port}`;

    res.json({
      imageUrl: `${protocol}://${host}/api/uploads/${filename}`,
    });
  } catch (error) {
    logger.error({ error }, "Upload error");
    res.status(500).json({ error: "InternalError", message: "Upload failed" });
  }
});

export default router;
