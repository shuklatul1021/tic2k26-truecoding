import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

function parseRouteId(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return Number.parseInt(rawValue || "", 10);
}

router.get("/:id/issues", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseRouteId(req.params.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid user id" });
      return;
    }

    if (req.user!.userId !== userId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Access denied" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT
         i.id,
         i.title,
         i.description,
         i.category,
         i.priority,
         i.status,
         i.image_url AS "imageUrl",
         i.resolved_image_url AS "resolvedImageUrl",
         i.latitude,
         i.longitude,
         i.address,
         i.assigned_to AS "assignedTo",
         i.confidence_score AS "confidenceScore",
         i.user_id AS "userId",
         i.created_at AS "createdAt",
         i.updated_at AS "updatedAt",
         u.name AS "userName",
         COUNT(uv.id) FILTER (WHERE uv.user_id <> i.user_id)::int AS upvotes,
         CASE
           WHEN $2::int = i.user_id THEN false
           ELSE EXISTS(
           SELECT 1
           FROM upvotes uv2
           WHERE uv2.issue_id = i.id AND uv2.user_id = $2
           )
         END AS "hasUpvoted"
       FROM issues i
       INNER JOIN users u ON u.id = i.user_id
       LEFT JOIN upvotes uv ON uv.issue_id = i.id
       WHERE i.user_id = $1
       GROUP BY i.id, u.name
       ORDER BY i.created_at DESC`,
      [userId, req.user!.userId],
    );

    res.json({
      issues: rows,
      total: rows.length,
      page: 1,
      totalPages: 1,
    });
  } catch (error) {
    logger.error({ error }, "Get user issues error");
    res.status(500).json({ error: "InternalError", message: "Failed to get user issues" });
  }
});

export default router;
