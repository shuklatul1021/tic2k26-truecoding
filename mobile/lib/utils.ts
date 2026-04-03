import type { IssueCategory, IssuePriority, IssueStatus } from "@/lib/api";

const categoryLabels: Record<IssueCategory, string> = {
  garbage: "Garbage",
  pothole: "Pothole",
  water_leakage: "Water Leakage",
  other: "Other",
};

const priorityLabels: Record<IssuePriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const statusLabels: Record<IssueStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatTime(value: string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDateTime(value: string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDateTimeInput(value: string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDistanceToNow(value: string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "just now";
  }

  const diffMs = parsed.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const absMinutes = Math.abs(diffMinutes);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absMinutes < 1) {
    return "just now";
  }

  if (absMinutes < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return rtf.format(diffDays, "day");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return rtf.format(diffWeeks, "week");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
}

export function getCategoryLabel(category: IssueCategory) {
  return categoryLabels[category];
}

export function getPriorityLabel(priority: IssuePriority) {
  return priorityLabels[priority];
}

export function getStatusLabel(status: IssueStatus) {
  return statusLabels[status];
}
