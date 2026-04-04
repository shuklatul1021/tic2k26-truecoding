function parseValidDate(dateStr?: string | null): Date | null {
  if (!dateStr) {
    return null;
  }

  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDistanceToNow(dateStr: string): string {
  const date = parseValidDate(dateStr);
  if (!date) return "recently";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return date.toLocaleDateString();
}

export function formatDate(dateStr: string): string {
  const date = parseValidDate(dateStr);
  if (!date) return "Date unavailable";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(dateStr: string): string {
  const date = parseValidDate(dateStr);
  if (!date) return "Time unavailable";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(dateStr?: string | null): string {
  const date = parseValidDate(dateStr);
  if (!date) return "Not set";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeInput(dateStr?: string | null): string {
  const date = parseValidDate(dateStr);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}

export function getPriorityLabel(priority: string): string {
  return { high: "High Priority", medium: "Medium Priority", low: "Low Priority" }[priority] || priority;
}

export function getCategoryLabel(cat: string): string {
  return { garbage: "Garbage", pothole: "Pothole", water_leakage: "Water Leakage", other: "Other" }[cat] || cat;
}

export function getStatusLabel(status: string): string {
  return {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    resolved: "Resolved",
    closed: "Closed",
  }[status] || status;
}
