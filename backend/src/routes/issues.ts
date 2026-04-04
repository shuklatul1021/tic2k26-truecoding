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
const ADMIN_IN_PROGRESS_LOCK_DAYS = 3;
const MIN_ASSIGNMENT_DURATION_MS = 24 * 60 * 60 * 1000;

router.use(optionalAuth);

function parseRouteId(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return Number.parseInt(rawValue || "", 10);
}

function parseOptionalDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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
       i.assignment_start_at AS "assignmentStartAt",
       i.due_at AS "dueAt",
       i.resolved_at AS "resolvedAt",
       i.verification_status AS "verificationStatus",
       i.verification_summary AS "verificationSummary",
       i.authenticity_score AS "authenticityScore",
       i.authenticity_confidence AS "authenticityConfidence",
       i.authenticity_explanation AS "authenticityExplanation",
       i.coverage_percentage AS "coveragePercentage",
       i.density_score AS "densityScore",
       i.detected AS "detected",
       i.explanation AS "explanation",
       i.is_real_image AS "isRealImage",
       i.image_subject AS "imageSubject",
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
       worker_profile.role_title AS "assignedWorkerRoleTitle",
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
     LEFT JOIN worker_profiles worker_profile ON worker_profile.user_id = i.assigned_worker_id
     LEFT JOIN upvotes uv ON uv.issue_id = i.id
     WHERE i.id = $1
     GROUP BY i.id, reporter.name, worker.name, worker_profile.role_title`,
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

  const latestAdminInProgressResult = await pool.query(
    `SELECT created_at AS "createdAt"
     FROM timeline_events
     WHERE issue_id = $1
       AND status = 'in_progress'
       AND note IN ('Admin marked issue in progress', 'Admin refreshed in-progress status')
     ORDER BY created_at DESC
     LIMIT 1`,
    [issueId],
  );

  const latestAssignedWorkerReportResult = issue.assignedWorkerId
    ? await pool.query(
        `SELECT
           status,
           created_at AS "createdAt"
         FROM worker_reports
         WHERE issue_id = $1
           AND worker_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [issueId, issue.assignedWorkerId],
      )
    : { rows: [] as Array<{ status: string; createdAt: string }> };

  const latestAdminInProgressAt = latestAdminInProgressResult.rows[0]?.createdAt
    ? new Date(latestAdminInProgressResult.rows[0].createdAt)
    : null;
  const inProgressLockedUntil = latestAdminInProgressAt
    ? addDays(latestAdminInProgressAt, ADMIN_IN_PROGRESS_LOCK_DAYS)
    : null;
  const latestWorkerReport = latestAssignedWorkerReportResult.rows[0];
  const workerMarkedResolved = latestWorkerReport?.status === "resolved";

  return {
    ...issue,
    timeline: timelineResult.rows,
    workerReports: reportsResult.rows,
    latestWorkerReportStatus: latestWorkerReport?.status ?? null,
    workerMarkedResolvedAt: workerMarkedResolved ? latestWorkerReport.createdAt : null,
    canAdminMarkResolved: Boolean(issue.assignedWorkerId && workerMarkedResolved),
    inProgressLockedUntil: inProgressLockedUntil?.toISOString() ?? null,
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
    const { status, priority, category, page = "1", limit = "20", latitude, longitude, radiusKm } = req.query as Record<
      string,
      string | undefined
    >;

    const pageNum = Math.max(1, Number.parseInt(page || "1", 10) || 1);
    const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit || "20", 10) || 20));
    const latitudeNum = latitude ? Number(latitude) : null;
    const longitudeNum = longitude ? Number(longitude) : null;
    const radiusKmNum = radiusKm ? Number(radiusKm) : 25;

    if ((latitude && !longitude) || (!latitude && longitude)) {
      res.status(400).json({ error: "BadRequest", message: "latitude and longitude must be provided together" });
      return;
    }

    if (latitude && longitude && (!Number.isFinite(latitudeNum) || !Number.isFinite(longitudeNum))) {
      res.status(400).json({ error: "BadRequest", message: "latitude and longitude must be valid numbers" });
      return;
    }

    if (!Number.isFinite(radiusKmNum) || radiusKmNum <= 0) {
      res.status(400).json({ error: "BadRequest", message: "radiusKm must be a valid positive number" });
      return;
    }

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
    let distanceSql: string | null = null;

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

    if (latitude && longitude) {
      values.push(latitudeNum);
      const latitudeParam = values.length;
      values.push(longitudeNum);
      const longitudeParam = values.length;
      values.push(radiusKmNum);
      const radiusParam = values.length;

      distanceSql = `6371 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(i.latitude - $${latitudeParam}) / 2), 2) +
        COS(RADIANS($${latitudeParam})) * COS(RADIANS(i.latitude)) *
        POWER(SIN(RADIANS(i.longitude - $${longitudeParam}) / 2), 2)
      ))`;

      conditions.push(`${distanceSql} <= $${radiusParam}`);
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
         i.authenticity_confidence AS "authenticityConfidence",
         i.authenticity_explanation AS "authenticityExplanation",
         i.coverage_percentage AS "coveragePercentage",
         i.density_score AS "densityScore",
         i.detected AS "detected",
         i.explanation AS "explanation",
         i.is_real_image AS "isRealImage",
         i.image_subject AS "imageSubject",
         i.location_verified AS "locationVerified",
         i.reward_points AS "rewardPoints",
         i.worker_points AS "workerPoints",
         i.worker_bonus_points AS "workerBonusPoints",
         i.confidence_score AS "confidenceScore",
         ${distanceSql ? `${distanceSql} AS "distanceKm",` : `NULL::double precision AS "distanceKm",`}
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
       ORDER BY ${distanceSql ? `"distanceKm" ASC,` : ""} i.created_at DESC
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

    logger.info(
      {
        imageUrl: imageUrl.trim(),
        imageSource,
        verification,
      },
      "Verify image route result",
    );
    console.log(
      `[VerifyImageRoute] ${JSON.stringify({
        imageUrl: imageUrl.trim(),
        imageSource,
        verification,
      })}`,
    );

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
         authenticity_confidence,
         authenticity_explanation,
         coverage_percentage,
         density_score,
         detected,
         explanation,
         is_real_image,
         image_subject,
         location_verified,
         image_source,
         captured_latitude,
         captured_longitude
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'verified', $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
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
        verification.authenticityConfidence,
        verification.authenticityExplanation,
        verification.coveragePercentage,
        verification.densityScore,
        verification.detected,
        verification.explanation,
        verification.isRealImage,
        verification.imageSubject,
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
      assignmentStartAt,
      dueAt,
      resolvedImageUrl,
      note,
    } = req.body as {
      status?: string;
      priority?: string;
      assignedTo?: string | null;
      assignedWorkerId?: number | null;
      assignmentStartAt?: string | null;
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

    if (assignmentStartAt && !parseOptionalDate(assignmentStartAt)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid assignment start date" });
      return;
    }

    if (dueAt && !parseOptionalDate(dueAt)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid assignment end date" });
      return;
    }

    const currentIssueResult = await pool.query(
      `SELECT
         id,
         status,
         user_id AS "userId",
         assigned_worker_id AS "assignedWorkerId",
         assignment_start_at AS "assignmentStartAt",
         due_at AS "dueAt"
       FROM issues
       WHERE id = $1
       LIMIT 1`,
      [issueId],
    );

    const currentIssue = currentIssueResult.rows[0] as
      | {
          id: number;
          status: string;
          userId: number;
          assignedWorkerId: number | null;
          assignmentStartAt: string | null;
          dueAt: string | null;
        }
      | undefined;

    if (!currentIssue) {
      res.status(404).json({ error: "NotFound", message: "Issue not found" });
      return;
    }

    const nextAssignedWorkerId =
      assignedWorkerId !== undefined ? assignedWorkerId : currentIssue.assignedWorkerId;
    const nextAssignmentStartAt =
      assignmentStartAt !== undefined ? assignmentStartAt : currentIssue.assignmentStartAt;
    const nextDueAt = dueAt !== undefined ? dueAt : currentIssue.dueAt;

    const nextAssignmentStartDate = parseOptionalDate(nextAssignmentStartAt);
    const nextDueDate = parseOptionalDate(nextDueAt);

    if ((assignmentStartAt !== undefined || dueAt !== undefined) && (!nextAssignmentStartDate || !nextDueDate)) {
      res.status(400).json({ error: "BadRequest", message: "Assignment start date and end date are both required" });
      return;
    }

    if (
      nextAssignmentStartDate &&
      nextDueDate &&
      nextDueDate.getTime() - nextAssignmentStartDate.getTime() < MIN_ASSIGNMENT_DURATION_MS
    ) {
      res.status(400).json({
        error: "BadRequest",
        message: "Assignment end date must be later than the start date",
      });
      return;
    }

    if (assignedWorkerId && !currentIssue.assignedWorkerId && (!nextAssignmentStartDate || !nextDueDate)) {
      res.status(400).json({ error: "BadRequest", message: "Select both start and end dates before assigning a worker" });
      return;
    }

    if (
      assignedWorkerId &&
      currentIssue.assignedWorkerId &&
      currentIssue.assignedWorkerId !== assignedWorkerId
    ) {
      res.status(409).json({
        error: "Conflict",
        message: "A worker is already assigned to this issue. Reassignment is not allowed.",
      });
      return;
    }

    if (status === "in_progress" && currentIssue.status === "in_progress") {
      const latestAdminInProgressResult = await pool.query(
        `SELECT created_at AS "createdAt"
         FROM timeline_events
         WHERE issue_id = $1
           AND status = 'in_progress'
           AND note IN ('Admin marked issue in progress', 'Admin refreshed in-progress status')
         ORDER BY created_at DESC
         LIMIT 1`,
        [issueId],
      );

      const latestAdminInProgressAt = latestAdminInProgressResult.rows[0]?.createdAt
        ? new Date(latestAdminInProgressResult.rows[0].createdAt)
        : null;

      if (latestAdminInProgressAt) {
        const lockedUntil = addDays(latestAdminInProgressAt, ADMIN_IN_PROGRESS_LOCK_DAYS);
        if (lockedUntil.getTime() > Date.now()) {
          res.status(409).json({
            error: "Conflict",
            message: `Issue already marked in progress. Try again after ${lockedUntil.toISOString()}.`,
          });
          return;
        }
      }
    }

    if (status === "resolved") {
      if (currentIssue.status === "resolved") {
        res.status(409).json({ error: "Conflict", message: "Issue is already resolved." });
        return;
      }

      if (!nextAssignedWorkerId) {
        res.status(409).json({
          error: "Conflict",
          message: "Assign a worker before marking this issue as resolved.",
        });
        return;
      }

      const latestWorkerReportResult = await pool.query(
        `SELECT status
         FROM worker_reports
         WHERE issue_id = $1
           AND worker_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [issueId, nextAssignedWorkerId],
      );

      if (latestWorkerReportResult.rows[0]?.status !== "resolved") {
        res.status(409).json({
          error: "Conflict",
          message: "Admin can mark this issue resolved only after the assigned worker submits a resolved update.",
        });
        return;
      }
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
    if (assignmentStartAt !== undefined) {
      values.push(assignmentStartAt || null);
      updates.push(`assignment_start_at = $${values.length}`);
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

    const isNewAssignment =
      assignedWorkerId !== undefined &&
      assignedWorkerId !== null &&
      currentIssue.assignedWorkerId !== assignedWorkerId;
    const isStatusChange = Boolean(status);

    if (isNewAssignment && assignedWorkerId) {
      const workerNameResult = await pool.query("SELECT name FROM users WHERE id = $1", [assignedWorkerId]);
      const workerName = workerNameResult.rows[0]?.name || "Worker";
      const scheduleSummary = [
        nextAssignmentStartAt ? `start ${new Date(nextAssignmentStartAt).toLocaleDateString("en-US")}` : null,
        nextDueAt ? `end ${new Date(nextDueAt).toLocaleDateString("en-US")}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      await pool.query(
        `INSERT INTO timeline_events (issue_id, status, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [
          issueId,
          status || currentIssue.status,
          note?.trim() || `Assigned to ${workerName}${scheduleSummary ? ` | ${scheduleSummary}` : ""}`,
          req.user!.email,
        ],
      );
    } else if (isStatusChange && status) {
      const defaultStatusNote =
        status === "in_progress"
          ? currentIssue.status === "in_progress"
            ? "Admin refreshed in-progress status"
            : "Admin marked issue in progress"
          : status === "resolved"
            ? "Admin confirmed issue resolved after worker completion"
            : `Status updated to ${status}`;

      await pool.query(
        `INSERT INTO timeline_events (issue_id, status, note, created_by)
         VALUES ($1, $2, $3, $4)`,
        [issueId, status, note?.trim() || defaultStatusNote, req.user!.email],
      );
    }

    if (status === "resolved" && currentIssue.status !== "resolved") {
      await awardResolutionRewards({
        issueId,
        reporterUserId: currentIssue.userId,
        workerUserId: nextAssignedWorkerId,
        dueAt: nextDueAt,
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
