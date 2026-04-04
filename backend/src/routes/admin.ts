import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const totalsResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::int AS resolved,
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

router.get("/workers", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.created_at AS "createdAt",
         wp.onboarding_completed AS "onboardingCompleted",
         wp.is_verified AS "workerVerified",
         wp.verified_at AS "verifiedAt",
         wp.role_title AS "roleTitle",
         wp.skills,
         creator.id AS "invitedByAdminId",
         creator.name AS "invitedByAdminName"
       FROM users u
       INNER JOIN worker_profiles wp ON wp.user_id = u.id
       LEFT JOIN users creator ON creator.id = wp.invited_by_admin_id
       WHERE u.role = 'worker'
       ORDER BY u.created_at DESC`,
    );

    res.json(
      result.rows,
    );
  } catch (error) {
    logger.error({ error }, "Get admin workers error");
    res.status(500).json({ error: "InternalError", message: "Failed to get workers" });
  }
});

router.post("/workers", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();

  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      res.status(400).json({
        error: "BadRequest",
        message: "Name, email and temporary password are required",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        error: "BadRequest",
        message: "Temporary password must be at least 6 characters",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    await client.query("BEGIN");

    const existingUser = await client.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [normalizedEmail]);
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Conflict", message: "Account already exists with this email" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdUser = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'worker')
       RETURNING
         id,
         name,
         email,
         role,
         points_balance AS "pointsBalance",
         wallet_balance AS "walletBalance",
         created_at AS "createdAt"`,
      [name.trim(), normalizedEmail, passwordHash],
    );

    const worker = createdUser.rows[0];

    await client.query(
      `INSERT INTO worker_profiles (
         user_id,
         invited_by_admin_id,
         is_verified,
         onboarding_completed
       ) VALUES ($1, $2, FALSE, FALSE)`,
      [worker.id, req.user!.userId],
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...worker,
      onboardingCompleted: false,
      workerVerified: false,
      roleTitle: null,
      skills: [],
      invitedByAdminId: req.user!.userId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ error }, "Create worker account error");
    res.status(500).json({ error: "InternalError", message: "Failed to create worker account" });
  } finally {
    client.release();
  }
});

export default router;
