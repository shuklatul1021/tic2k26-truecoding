import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

type Category = "garbage" | "pothole" | "water_leakage" | "other";
type Priority = "high" | "medium" | "low";

function classifyByKeywords(imageUrl: string) {
  const normalized = imageUrl.toLowerCase();

  if (normalized.includes("water") || normalized.includes("leak") || normalized.includes("flood")) {
    return {
      category: "water_leakage" as Category,
      priority: "high" as Priority,
      confidence: 0.85,
      description: "Water leakage detected - immediate action required",
    };
  }

  if (normalized.includes("pothole") || normalized.includes("road") || normalized.includes("crack")) {
    return {
      category: "pothole" as Category,
      priority: "high" as Priority,
      confidence: 0.8,
      description: "Road damage or pothole detected - safety hazard",
    };
  }

  if (
    normalized.includes("garbage") ||
    normalized.includes("trash") ||
    normalized.includes("waste") ||
    normalized.includes("litter")
  ) {
    return {
      category: "garbage" as Category,
      priority: "medium" as Priority,
      confidence: 0.88,
      description: "Garbage or waste accumulation detected",
    };
  }

  return {
    category: "other" as Category,
    priority: "low" as Priority,
    confidence: 0.6,
    description: "Civic issue detected requiring attention",
  };
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const { imageUrl } = req.body as { imageUrl?: string };
    if (!imageUrl?.trim()) {
      res.status(400).json({ error: "BadRequest", message: "imageUrl is required" });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    res.json(classifyByKeywords(imageUrl.trim()));
  } catch (error) {
    logger.error({ error }, "Classification error");
    res.status(500).json({ error: "InternalError", message: "Classification failed" });
  }
});

export default router;
