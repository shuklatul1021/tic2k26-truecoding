import { pool } from "./pool.js";

export type UserRole = "user" | "admin" | "worker";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type ImageSource = "camera" | "gallery";
export type IssueCategory = "garbage" | "pothole" | "water_leakage" | "other";
export type IssuePriority = "high" | "medium" | "low";
export type IssueStatus = "pending" | "in_progress" | "resolved";

export const ISSUE_CATEGORIES: IssueCategory[] = [
  "garbage",
  "pothole",
  "water_leakage",
  "other",
];

export const ISSUE_PRIORITIES: IssuePriority[] = ["high", "medium", "low"];
export const ISSUE_STATUSES: IssueStatus[] = ["pending", "in_progress", "resolved"];

export function isIssueCategory(value: string): value is IssueCategory {
  return ISSUE_CATEGORIES.includes(value as IssueCategory);
}

export function isIssuePriority(value: string): value is IssuePriority {
  return ISSUE_PRIORITIES.includes(value as IssuePriority);
}

export function isIssueStatus(value: string): value is IssueStatus {
  return ISSUE_STATUSES.includes(value as IssueStatus);
}

export async function getUserStats(userId: number) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS "issuesReported",
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS "issuesResolved"
     FROM issues
     WHERE user_id = $1`,
    [userId],
  );

  return rows[0] as { issuesReported: number; issuesResolved: number };
}
