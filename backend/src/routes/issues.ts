import { Router } from "express";
import { pool } from "../db/pool.js";
import { awardResolutionRewards } from "../services/rewards.js";
import { precheckIssueImage, verifyIssueSubmission } from "../services/verification.js";
import {
  isIssueCategory,
  isIssuePriority,
  isIssueStatus,
} from "../db/queries.js";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.use(optionalAuth);

function parseRouteId(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return Number.parseInt(rawValue || "", 10);
}

async function loadIssueDetail(issueId: number, currentUserId?: number | null) {
  const issueResult = await pool.query(
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
       i.assigned_worker_id AS "assignedWorkerId",
       i.due_at AS "dueAt",
       i.resolved_at AS "resolvedAt",
       i.verification_status AS "verificationStatus",
       i.verification_summary AS "verificationSummary",
       i.authenticity_score AS "authenticityScore",
       i.location_verified AS "locationVerified",
       i.image_source AS "imageSource",
       i.captured_latitude AS "capturedLatitude",
       i.captured_longitude AS "capturedLongitude",
       i.reward_points AS "rewardPoints",
       i.worker_points AS "workerPoints",
       i.worker_bonus_points AS "workerBonusPoints",
       i.confidence_score AS "confidenceScore",
       i.user_id AS "userId",
       i.created_at AS "createdAt",
       i.updated_at AS "updatedAt",
       reporter.name AS "userName",
       worker.name AS "assignedWorkerName",
       COUNT(uv.id)::int AS upvotes,
       CASE
         WHEN $2::int IS NULL THEN false
         ELSE EXISTS(
           SELECT 1
           FROM upvotes uv2
           WHERE uv2.issue_id = i.id AND uv2.user_id = $2
         )
       END AS "hasUpvoted"
     FROM issues i
     INNER JOIN users reporter ON reporter.id = i.user_id
     LEFT JOIN users worker ON worker.id = i.assigned_worker_id
     LEFT JOIN upvotes uv ON uv.issue_id = i.id
     WHERE i.id = $1
     GROUP BY i.id, reporter.name, worker.name`,
    [issueId, currentUserId ?? null],
  );

  const issue = issueResult.rows[0];
  if (!issue) {
    return null;
  }

  const timelineResult = await pool.query(
    `SELECT
       id,
       issue_id AS "issueId",
       status,
       note,
       created_by AS "createdBy",
       created_at AS "createdAt"
     FROM timeline_events
     WHERE issue_id = $1
     ORDER BY created_at DESC`,
    [issueId],
  );

  const reportsResult = await pool.query(
    `SELECT
       wr.id,
       wr.issue_id AS "issueId",
       wr.worker_id AS "workerId",
       wr.note,
       wr.status,
       wr.image_url AS "imageUrl",
       wr.image_verification_status AS "imageVerificationStatus",
       wr.image_verification_summary AS "imageVerificationSummary",
       wr.created_at AS "createdAt",
       u.name AS "workerName"
     FROM worker_reports wr
     INNER JOIN users u ON u.id = wr.worker_id
     WHERE wr.issue_id = $1
     ORDER BY wr.created_at DESC`,
    [issueId],
  );

  return {
    ...issue,
    timeline: timelineResult.rows,
    workerReports: reportsResult.rows,
  };
}

router.get("/map", async (_req: AuthenticatedRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         i.id,
         i.title,
         i.category,
         i.priority,
         i.status,
         i.latitude,
         i.longitude,
         COUNT(u.id)::int AS upvotes
       FROM issues i
       LEFT JOIN upvotes u ON u.issue_id = i.id
       WHERE i.verification_status = 'verified'
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
    );

    res.json(rows);
  } catch (error) {
    logger.error({ error }, "Get map issues error");
    res.status(500).json({ error: "InternalError", message: "Failed to get map issues" });
  }
});

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { status, priority, category, page = "1", limit = "20" } = req.query as Record<
      string,
      string | undefined
    >;

    const pageNum = Math.max(1, Number.parseInt(page || "1", 10) || 1);
    const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit || "20", 10) || 20));

    if (status && !isIssueStatus(status)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid status filter" });
      return;
    }

    if (priority && !isIssuePriority(priority)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid priority filter" });
      return;
    }

    if (category && !isIssueCategory(category)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid category filter" });
      return;
    }

    const values: Array<string | number | null> = ["verified"];
    const conditions: string[] = [`i.verification_status = $${values.length}`];

    if (status) {
      values.push(status);
      conditions.push(`i.status = $${values.length}`);
    }
    if (priority) {
      values.push(priority);
      conditions.push(`i.priority = $${values.length}`);
    }
    if (category) {
      values.push(category);
      conditions.push(`i.category = $${values.length}`);
    }

    const whereSql = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM issues i ${whereSql}`,
      values,
    );

    values.push(req.user?.userId ?? null);
    const currentUserParam = values.length;
    values.push(limitNum);
    const limitParam = values.length;
    values.push((pageNum - 1) * limitNum);
    const offsetParam = values.length;

    const issuesResult = await pool.query(
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
         i.assigned_worker_id AS "assignedWorkerId",
         worker.name AS "assignedWorkerName",
         i.due_at AS "dueAt",
         i.verification_status AS "verificationStatus",
         i.verification_summary AS "verificationSummary",
         i.authenticity_score AS "authenticityScore",
         i.location_verified AS "locationVerified",
         i.reward_points AS "rewardPoints",
         i.worker_points AS "workerPoints",
         i.worker_bonus_points AS "workerBonusPoints",
         i.confidence_score AS "confidenceScore",
         i.user_id AS "userId",
         reporter.name AS "userName",
         COUNT(uv.id)::int AS upvotes,
         CASE
           WHEN $${currentUserParam}::int IS NULL THEN false
           ELSE EXISTS(
             SELECT 1
             FROM upvotes uv2
             WHERE uv2.issue_id = i.id AND uv2.user_id = $${currentUserParam}
           )
         END AS "hasUpvoted"
       FROM issues i
       INNER JOIN users reporter ON reporter.id = i.user_id
       LEFT JOIN users worker ON worker.id = i.assigned_worker_id
       LEFT JOIN upvotes uv ON uv.issue_id = i.id
       ${whereSql}
       GROUP BY i.id, reporter.name, worker.name
       ORDER BY i.created_at DESC
       LIMIT $${limitParam}
       OFFSET $${offsetParam}`,
      values,
    );

    const total = Number(countResult.rows[0]?.total || 0);
    res.json({
      issues: issuesResult.rows,
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    logger.error({ error }, "Get issues error");
    res.status(500).json({ error: "InternalError", message: "Failed to get issues" });
  }
});

router.post("/verify-image", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { imageUrl, imageSource } = req.body as {
      imageUrl?: string;
      imageSource?: "camera" | "gallery";
    };

    if (!imageUrl?.trim() || !imageSource) {
      res.status(400).json({ error: "BadRequest", message: "imageUrl and imageSource are required" });
      return;
    }

    const verification = await precheckIssueImage({
      imageUrl: imageUrl.trim(),
      imageSource,
    });

    if (!verification.accepted) {
      res.status(422).json({
        error: "VerificationFailed",
        message: verification.verificationSummary,
        verification,
      });
      return;
    }

    res.json(verification);
  } catch (error) {
    logger.error({ error }, "Verify issue image error");
    res.status(500).json({ error: "InternalError", message: "Failed to verify image" });
  }
});

router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      imageUrl,
      latitude,
      longitude,
      address,
      captureLatitude,
      captureLongitude,
      imageSource,
    } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      priority?: string;
      imageUrl?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
      captureLatitude?: number | null;
      captureLongitude?: number | null;
      imageSource?: "camera" | "gallery";
    };

    if (
      !title?.trim() ||
      !description?.trim() ||
      !imageUrl?.trim() ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !imageSource
    ) {
      res.status(400).json({ error: "BadRequest", message: "Missing required fields" });
      return;
    }

    const verification = await verifyIssueSubmission({
      imageUrl: imageUrl.trim(),
      reportLatitude: latitude,
      reportLongitude: longitude,
      captureLatitude,
      captureLongitude,
      imageSource,
    });

    if (!verification.accepted) {
      res.status(422).json({
        error: "VerificationFailed",
        message: verification.verificationSummary,
        verification,
      });
      return;
    }

    const finalCategory = category && isIssueCategory(category) ? category : verification.category;
    const finalPriority = priority && isIssuePriority(priority) ? priority : verification.priority;

    const { rows } = await pool.query(
      `INSERT INTO issues (
         title,
         description,
         category,
         priority,
         image_url,
         latitude,
         longitude,
         address,
         confidence_score,
         user_id,
         verification_status,
         verification_summary,
         authenticity_score,
         location_verified,
         image_source,
         captured_latitude,
         captured_longitude
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'verified', $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        title.trim(),
        description.trim(),
        finalCategory,
        finalPriority,
        imageUrl.trim(),
        latitude,
        longitude,
        address?.trim() || null,
        verification.confidenceScore,
        req.user!.userId,
        verification.verificationSummary,
        verification.authenticityScore,
        verification.locationVerified,
        imageSource,
        typeof captureLatitude === "number" ? captureLatitude : null,
        typeof captureLongitude === "number" ? captureLongitude : null,
      ],
    );

    const issueId = rows[0].id as number;

    await pool.query(
      `INSERT INTO timeline_events (issue_id, status, note, created_by)
       VALUES ($1, $2, $3, $4)`,
      [issueId, "pending", "Issue verified and published", req.user!.email],
    );

    const detail = await loadIssueDetail(issueId, req.user!.userId);
    res.status(201).json(detail);
  } catch (error) {
    logger.error({ error }, "Create issue error");
    res.status(500).json({ error: "InternalError", message: "Failed to create issue" });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const issueId = parseRouteId(req.params.id);
    if (!Number.isFinite(issueId)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid issue id" });
      return;
    }

    const issue = await loadIssueDetail(issueId, req.user?.userId);
    if (!issue) {
      res.status(404).json({ error: "NotFound", message: "Issue not found" });
      return;
    }

    res.json(issue);
  } catch (error) {
    logger.error({ error }, "Get issue error");
    res.status(500).json({ error: "InternalError", message: "Failed to get issue" });
  }
});

router.patch("/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const issueId = parseRouteId(req.params.id);
    if (!Number.isFinite(issueId)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid issue id" });
      return;
    }

    const {
      status,
      priority,
      assignedTo,
      assignedWorkerId,
      dueAt,
      resolvedImageUrl,
      note,
    } = req.body as {
      status?: string;
      priority?: string;
      assignedTo?: string | null;
      assignedWorkerId?: number | null;
      dueAt?: string | null;
      resolvedImageUrl?: string | null;
      note?: string;
    };

    if (status && !isIssueStatus(status)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid status" });
      return;
    }

    if (priority && !isIssuePriority(priority)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid priority" });
      return;
    }

    const currentIssueResult = await pool.query(
      `SELECT id, status, user_id AS "userId", assigned_worker_id AS "assignedWorkerId", due_at AS "dueAt"
       FROM issues
       WHERE id = $1
       LIMIT 1`,
      [issueId],
    );

    const currentIssue = currentIssueResult.rows[0] as
      | { id: number; status: string; userId: number; assignedWorkerId: number | null; dueAt: string | null }
      | undefined;

    if (!currentIssue) {
      res.status(404).json({ error: "NotFound", message: "Issue not found" });
      return;
    }

    const updates: string[] = ["updated_at = NOW()"];
    const values: Array<string | number | null> = [];

    if (status) {
      values.push(status);
      updates.push(`status = $${values.length}`);
      if (status === "resolved") {
        updates.push("resolved_at = NOW()");
      }
    }
    if (priority) {
      values.push(priority);
      updates.push(`priority = $${values.length}`);
    }
    if (assignedTo !== undefined) {
      values.push(assignedTo?.trim() || null);
      updates.push(`assigned_to = $${values.length}`);
    }
    if (assignedWorkerId !== undefined) {
      values.push(assignedWorkerId ?? null);
      updates.push(`assigned_worker_id = $${values.length}`);
    }
    if (dueAt !== undefined) {
      values.push(dueAt || null);
      updates.push(`due_at = $${values.length}`);
    }
    if (resolvedImageUrl !== undefined) {
      values.push(resolvedImageUrl?.trim() || null);
      updates.push(`resolved_image_url = $${values.length}`);
    }

    values.push(issueId);
    const issueIdParam = values.length;

    await pool.query(
      `UPDATE issues
       SET ${updates.join(", ")}
       WHERE id = $${issueIdParam}`,
      values,
    );

    if (assignedWorkerId) {
      const workerNameResult = await pool.query("SELECT name FROM users WHERE id = $1", [assignedWorkerId]);
      const workerName = workerNameResult.rows[0]?.name || "Worker";
      await pool.query(
        `INSERT INTO timeline_events (issue_id, status, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [
          issueId,
          status || currentIssue.status,
          note?.trim() || `Assigned to ${workerName}${dueAt ? ` with deadline ${dueAt}` : ""}`,
          req.user!.email,
        ],
      );
    } else if (status) {
      await pool.query(
        `INSERT INTO timeline_events (issue_id, status, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [issueId, status, note?.trim() || `Status updated to ${status}`, req.user!.email],
      );
    }

    if (status === "resolved" && currentIssue.status !== "resolved") {
      await awardResolutionRewards({
        issueId,
        reporterUserId: currentIssue.userId,
        workerUserId:
          assignedWorkerId !== undefined ? assignedWorkerId : currentIssue.assignedWorkerId,
        dueAt: dueAt !== undefined ? dueAt : currentIssue.dueAt,
      });
    }

    const detail = await loadIssueDetail(issueId, req.user!.userId);
    res.json(detail);
  } catch (error) {
    logger.error({ error }, "Update issue error");
    res.status(500).json({ error: "InternalError", message: "Failed to update issue" });
  }
});

router.post("/:id/upvote", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const issueId = parseRouteId(req.params.id);
    if (!Number.isFinite(issueId)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid issue id" });
      return;
    }

    const existing = await pool.query(
      "SELECT id FROM upvotes WHERE issue_id = $1 AND user_id = $2 LIMIT 1",
      [issueId, req.user!.userId],
    );

    let hasUpvoted = false;
    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query("DELETE FROM upvotes WHERE issue_id = $1 AND user_id = $2", [
        issueId,
        req.user!.userId,
      ]);
      hasUpvoted = false;
    } else {
      await pool.query("INSERT INTO upvotes (issue_id, user_id) VALUES ($1, $2)", [
        issueId,
        req.user!.userId,
      ]);
      hasUpvoted = true;
    }

    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS upvotes FROM upvotes WHERE issue_id = $1",
      [issueId],
    );

    res.json({
      upvotes: countResult.rows[0]?.upvotes || 0,
      hasUpvoted,
    });
  } catch (error) {
    logger.error({ error }, "Upvote error");
    res.status(500).json({ error: "InternalError", message: "Failed to upvote" });
  }
});

router.get("/:id/timeline", async (req, res) => {
  try {
    const issueId = parseRouteId(req.params.id);
    if (!Number.isFinite(issueId)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid issue id" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         issue_id AS "issueId",
         status,
         note,
         created_by AS "createdBy",
         created_at AS "createdAt"
       FROM timeline_events
       WHERE issue_id = $1
       ORDER BY created_at DESC`,
      [issueId],
    );

    res.json(rows);
  } catch (error) {
    logger.error({ error }, "Get timeline error");
    res.status(500).json({ error: "InternalError", message: "Failed to get timeline" });
  }
});

export default router;
