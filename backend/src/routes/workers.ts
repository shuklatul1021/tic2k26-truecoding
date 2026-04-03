import { Router, type Response } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { logger } from "../lib/logger.js";
import { verifyWorkerReportImage } from "../services/verification.js";

const router = Router();

function requireWorker(req: AuthenticatedRequest, res: Response, next: () => void) {
  if (req.user?.role !== "worker") {
    res.status(403).json({ error: "Forbidden", message: "Worker access required" });
    return;
  }
  next();
}

function parseRouteId(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return Number.parseInt(rawValue || "", 10);
}

function distanceInKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

router.get("/nearby", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }

    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radiusKm = Number(req.query.radiusKm || 25);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ error: "BadRequest", message: "latitude and longitude are required" });
      return;
    }

    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.points_balance AS "pointsBalance",
         u.wallet_balance AS "walletBalance",
         wp.skills,
         wp.work_latitude AS "workLatitude",
         wp.work_longitude AS "workLongitude",
         wp.work_address AS "workAddress",
         wp.onboarding_completed AS "onboardingCompleted",
         wp.is_available AS "isAvailable"
       FROM users u
       INNER JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.role = 'worker'
         AND wp.onboarding_completed = TRUE
         AND wp.is_available = TRUE`,
    );

    const nearbyWorkers = result.rows
      .map((worker) => {
        const distance =
          typeof worker.workLatitude === "number" && typeof worker.workLongitude === "number"
            ? distanceInKm(latitude, longitude, worker.workLatitude, worker.workLongitude)
            : Number.POSITIVE_INFINITY;

        return { ...worker, distanceKm: Number(distance.toFixed(2)) };
      })
      .filter((worker) => worker.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json(nearbyWorkers);
  } catch (error) {
    logger.error({ error }, "Get nearby workers error");
    res.status(500).json({ error: "InternalError", message: "Failed to get workers" });
  }
});

router.post("/me/onboarding", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    requireWorker(req, res, async () => {
      const { skills, workLatitude, workLongitude, workAddress } = req.body as {
        skills?: string[];
        workLatitude?: number;
        workLongitude?: number;
        workAddress?: string;
      };

      if (!Array.isArray(skills) || skills.length === 0) {
        res.status(400).json({ error: "BadRequest", message: "At least one skill is required" });
        return;
      }

      await pool.query(
        `UPDATE worker_profiles
         SET skills = $2,
             work_latitude = $3,
             work_longitude = $4,
             work_address = $5,
             onboarding_completed = TRUE,
             updated_at = NOW()
         WHERE user_id = $1`,
        [
          req.user!.userId,
          skills,
          typeof workLatitude === "number" ? workLatitude : null,
          typeof workLongitude === "number" ? workLongitude : null,
          workAddress?.trim() || null,
        ],
      );

      const me = await pool.query(
        `SELECT
           u.id,
           u.name,
           u.email,
           u.role,
           u.points_balance AS "pointsBalance",
           u.wallet_balance AS "walletBalance",
           u.created_at AS "createdAt"
         FROM users u
         WHERE u.id = $1`,
        [req.user!.userId],
      );

      res.json({
        ...me.rows[0],
        onboardingCompleted: true,
      });
    });
  } catch (error) {
    logger.error({ error }, "Worker onboarding error");
    res.status(500).json({ error: "InternalError", message: "Worker onboarding failed" });
  }
});

router.get("/me/assignments", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    requireWorker(req, res, async () => {
      const result = await pool.query(
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
           i.verification_status AS "verificationStatus",
           i.verification_summary AS "verificationSummary",
           i.location_verified AS "locationVerified",
           i.reward_points AS "rewardPoints",
           i.worker_points AS "workerPoints",
           i.worker_bonus_points AS "workerBonusPoints",
           i.due_at AS "dueAt",
           i.created_at AS "createdAt",
           i.updated_at AS "updatedAt",
           u.name AS "userName",
           COUNT(uv.id)::int AS upvotes
         FROM issues i
         INNER JOIN users u ON u.id = i.user_id
         LEFT JOIN upvotes uv ON uv.issue_id = i.id
         WHERE i.assigned_worker_id = $1
         GROUP BY i.id, u.name
         ORDER BY i.created_at DESC`,
        [req.user!.userId],
      );

      res.json(result.rows);
    });
  } catch (error) {
    logger.error({ error }, "Worker assignments error");
    res.status(500).json({ error: "InternalError", message: "Failed to get assignments" });
  }
});

router.post("/issues/:id/reports", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    requireWorker(req, res, async () => {
      const issueId = parseRouteId(req.params.id);
      const { note, status, imageUrl } = req.body as {
        note?: string;
        status?: string;
        imageUrl?: string | null;
      };

      if (!Number.isFinite(issueId) || !note?.trim() || !status?.trim()) {
        res.status(400).json({ error: "BadRequest", message: "Issue id, note and status are required" });
        return;
      }

      const assignment = await pool.query(
        `SELECT id FROM issues WHERE id = $1 AND assigned_worker_id = $2 LIMIT 1`,
        [issueId, req.user!.userId],
      );

      if (!assignment.rowCount) {
        res.status(404).json({ error: "NotFound", message: "Assigned issue not found" });
        return;
      }

      const verification = await verifyWorkerReportImage(imageUrl || null);

      const result = await pool.query(
        `INSERT INTO worker_reports (
           issue_id,
           worker_id,
           note,
           status,
           image_url,
           image_verification_status,
           image_verification_summary
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING
           id,
           issue_id AS "issueId",
           worker_id AS "workerId",
           note,
           status,
           image_url AS "imageUrl",
           image_verification_status AS "imageVerificationStatus",
           image_verification_summary AS "imageVerificationSummary",
           created_at AS "createdAt"`,
        [
          issueId,
          req.user!.userId,
          note.trim(),
          status.trim(),
          imageUrl?.trim() || null,
          verification.status,
          verification.summary,
        ],
      );

      await pool.query(
        `INSERT INTO timeline_events (issue_id, status, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [issueId, "in_progress", `Worker update: ${note.trim()}`, req.user!.email],
      );

      res.status(201).json(result.rows[0]);
    });
  } catch (error) {
    logger.error({ error }, "Worker report error");
    res.status(500).json({ error: "InternalError", message: "Failed to create worker report" });
  }
});

export default router;
