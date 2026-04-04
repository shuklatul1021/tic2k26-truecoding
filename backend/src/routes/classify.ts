import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { classifyIssueImage } from "../services/verification.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { imageUrl } = req.body as { imageUrl?: string };
    if (!imageUrl?.trim()) {
      res.status(400).json({ error: "BadRequest", message: "imageUrl is required" });
      return;
    }

    res.json(await classifyIssueImage(imageUrl.trim()));
  } catch (error) {
    logger.error({ error }, "Classification error");
    res.status(500).json({ error: "InternalError", message: "Classification failed" });
  }
});

export default router;
