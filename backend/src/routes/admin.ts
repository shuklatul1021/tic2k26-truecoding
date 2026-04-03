import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAdmin } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const totalsResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
         COUNT(*) FILTER (WHERE priority = 'high')::int AS high
       FROM issues`,
    );

    const usersResult = await pool.query("SELECT COUNT(*)::int AS count FROM users");

    const totals = totalsResult.rows[0] || {
      total: 0,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      high: 0,
    };

    const totalIssues = Number(totals.total || 0);
    const resolvedIssues = Number(totals.resolved || 0);

    res.json({
      totalIssues,
      pendingIssues: Number(totals.pending || 0),
      inProgressIssues: Number(totals.in_progress || 0),
      resolvedIssues,
      highPriorityIssues: Number(totals.high || 0),
      totalUsers: Number(usersResult.rows[0]?.count || 0),
      resolutionRate: totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0,
    });
  } catch (error) {
    logger.error({ error }, "Get admin stats error");
    res.status(500).json({ error: "InternalError", message: "Failed to get stats" });
  }
});

export default router;
