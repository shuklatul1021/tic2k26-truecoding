import Constants from "expo-constants";

export type Role = "user" | "admin" | "worker";
export type IssueStatus = "pending" | "in_progress" | "resolved";
export type IssuePriority = "high" | "medium" | "low";
export type IssueCategory = "garbage" | "pothole" | "water_leakage" | "other";
export type ImageSource = "camera" | "gallery";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  pointsBalance: number;
  walletBalance: number;
  createdAt: string;
  issuesReported: number;
  issuesResolved: number;
  onboardingCompleted?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TimelineEvent {
  id: number;
  issueId: number;
  status: IssueStatus;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface WorkerReport {
  id: number;
  issueId: number;
  workerId: number;
  workerName?: string | null;
  note: string;
  status: string;
  imageUrl: string | null;
  imageVerificationStatus?: string | null;
  imageVerificationSummary?: string | null;
  createdAt: string;
}

export interface Issue {
  id: number;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  imageUrl: string;
  resolvedImageUrl?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  assignedTo?: string | null;
  assignedWorkerId?: number | null;
  assignedWorkerName?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  verificationStatus?: string | null;
  verificationSummary?: string | null;
  authenticityScore?: number | null;
  locationVerified?: boolean | null;
  imageSource?: ImageSource | null;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
  rewardPoints?: number | null;
  workerPoints?: number | null;
  workerBonusPoints?: number | null;
  confidenceScore?: number | null;
  userId: number;
  userName: string;
  upvotes: number;
  hasUpvoted: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface IssueDetail extends Issue {
  timeline: TimelineEvent[];
  workerReports: WorkerReport[];
}

export interface PaginatedIssues {
  issues: Issue[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MapIssue {
  id: number;
  title: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  upvotes: number;
}

export interface NearbyWorker {
  id: number;
  name: string;
  email: string;
  pointsBalance: number;
  walletBalance: number;
  skills: string[] | null;
  workLatitude: number | null;
  workLongitude: number | null;
  workAddress: string | null;
  onboardingCompleted: boolean;
  isAvailable: boolean;
  distanceKm: number;
}

export interface AdminStats {
  totalIssues: number;
  pendingIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  highPriorityIssues: number;
  totalUsers: number;
  resolutionRate: number;
}

export interface UploadResponse {
  imageUrl: string;
}

export interface ClassificationResult {
  category: IssueCategory;
  priority: IssuePriority;
  confidence: number;
  description: string;
}

export interface VerificationResult {
  accepted: boolean;
  category?: IssueCategory;
  priority?: IssuePriority;
  confidenceScore?: number;
  verificationSummary: string;
  authenticityScore?: number;
  locationVerified?: boolean;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

const configuredBackendUrl =
  typeof Constants.expoConfig?.extra?.backendUrl === "string"
    ? Constants.expoConfig.extra.backendUrl
    : "http://10.56.214.101:3001";

const backendUrl = configuredBackendUrl.replace(/\/+$/, "");
const apiBaseUrl = `${backendUrl}/api`;

let authToken: string | null = null;

export function getBackendUrl() {
  return backendUrl;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

function normalizeAssetUrl(url: string | null | undefined) {
  if (!url) {
    return url ?? null;
  }

  if (url.startsWith("/")) {
    return `${backendUrl}${url}`;
  }

  try {
    const assetUrl = new URL(url);
    const baseUrl = new URL(backendUrl);

    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(assetUrl.hostname)) {
      assetUrl.protocol = baseUrl.protocol;
      assetUrl.host = baseUrl.host;
      return assetUrl.toString();
    }
  } catch {
    return url;
  }

  return url;
}

function normalizeUser(user: User): User {
  return {
    ...user,
    pointsBalance: Number(user.pointsBalance ?? 0),
    walletBalance: Number(user.walletBalance ?? 0),
    issuesReported: Number(user.issuesReported ?? 0),
    issuesResolved: Number(user.issuesResolved ?? 0),
  };
}

function normalizeWorkerReport(report: WorkerReport): WorkerReport {
  return {
    ...report,
    imageUrl: normalizeAssetUrl(report.imageUrl),
  };
}

function normalizeIssue(issue: Issue): Issue {
  return {
    ...issue,
    imageUrl: normalizeAssetUrl(issue.imageUrl) ?? "",
    resolvedImageUrl: normalizeAssetUrl(issue.resolvedImageUrl),
    upvotes: Number(issue.upvotes ?? 0),
    rewardPoints: issue.rewardPoints == null ? null : Number(issue.rewardPoints),
    workerPoints: issue.workerPoints == null ? null : Number(issue.workerPoints),
    workerBonusPoints:
      issue.workerBonusPoints == null ? null : Number(issue.workerBonusPoints),
    confidenceScore: issue.confidenceScore == null ? null : Number(issue.confidenceScore),
  };
}

function normalizeIssueDetail(issue: IssueDetail): IssueDetail {
  return {
    ...normalizeIssue(issue),
    timeline: (issue.timeline ?? []).map((event) => ({
      ...event,
      note: event.note ?? null,
      createdBy: event.createdBy ?? null,
    })),
    workerReports: (issue.workerReports ?? []).map(normalizeWorkerReport),
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const hasBody = options.body !== undefined;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });

    const rawText = await response.text();
    const payload = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      const errorMessage =
        payload?.message ||
        payload?.error ||
        `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Backend returned an invalid response.");
    }

    if (error instanceof TypeError) {
      throw new Error(
        `Could not reach backend at ${backendUrl}. Make sure the server is running and reachable from the mobile device.`,
      );
    }

    throw error;
  }
}

export const authApi = {
  login(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }).then((response) => ({
      ...response,
      user: normalizeUser(response.user),
    }));
  },

  register(name: string, email: string, password: string) {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password },
    }).then((response) => ({
      ...response,
      user: normalizeUser(response.user),
    }));
  },

  registerAdmin(name: string, email: string, password: string) {
    return request<AuthResponse>("/auth/register-admin", {
      method: "POST",
      body: { name, email, password },
    }).then((response) => ({
      ...response,
      user: normalizeUser(response.user),
    }));
  },

  workerLogin(email: string, aadhaarNumber: string) {
    return request<AuthResponse>("/auth/worker-login", {
      method: "POST",
      body: { email, aadhaarNumber },
    }).then((response) => ({
      ...response,
      user: normalizeUser(response.user),
    }));
  },

  workerRegister(name: string, email: string, aadhaarNumber: string) {
    return request<AuthResponse>("/auth/worker-register", {
      method: "POST",
      body: { name, email, aadhaarNumber },
    }).then((response) => ({
      ...response,
      user: normalizeUser(response.user),
    }));
  },

  me() {
    return request<User>("/auth/me").then(normalizeUser);
  },
};

export const issuesApi = {
  getAll(filters: {
    status?: IssueStatus;
    priority?: IssuePriority;
    category?: IssueCategory;
    page?: number;
    limit?: number;
  }) {
    const search = new URLSearchParams();

    if (filters.status) search.set("status", filters.status);
    if (filters.priority) search.set("priority", filters.priority);
    if (filters.category) search.set("category", filters.category);
    if (filters.page) search.set("page", String(filters.page));
    if (filters.limit) search.set("limit", String(filters.limit));

    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<PaginatedIssues>(`/issues${suffix}`).then((response) => ({
      ...response,
      issues: response.issues.map(normalizeIssue),
    }));
  },

  getById(id: number) {
    return request<IssueDetail>(`/issues/${id}`).then(normalizeIssueDetail);
  },

  getMap() {
    return request<MapIssue[]>("/issues/map");
  },

  getUserIssues(userId: number) {
    return request<PaginatedIssues>(`/users/${userId}/issues`).then((response) => ({
      ...response,
      issues: response.issues.map(normalizeIssue),
    }));
  },

  verifyImage(input: { imageUrl: string; imageSource: ImageSource }) {
    return request<VerificationResult>("/issues/verify-image", {
      method: "POST",
      body: input,
    });
  },

  create(payload: {
    title: string;
    description: string;
    category?: IssueCategory;
    priority?: IssuePriority;
    imageUrl: string;
    latitude: number;
    longitude: number;
    address?: string;
    imageSource: ImageSource;
    captureLatitude?: number | null;
    captureLongitude?: number | null;
  }) {
    return request<IssueDetail>("/issues", {
      method: "POST",
      body: payload,
    }).then(normalizeIssueDetail);
  },

  update(
    id: number,
    payload: {
      status?: IssueStatus;
      priority?: IssuePriority;
      assignedTo?: string | null;
      assignedWorkerId?: number | null;
      dueAt?: string | null;
      resolvedImageUrl?: string | null;
      note?: string;
    },
  ) {
    return request<IssueDetail>(`/issues/${id}`, {
      method: "PATCH",
      body: payload,
    }).then(normalizeIssueDetail);
  },

  upvote(id: number) {
    return request<{ upvotes: number; hasUpvoted: boolean }>(`/issues/${id}/upvote`, {
      method: "POST",
    });
  },
};

export const workersApi = {
  getNearby(latitude: number, longitude: number, radiusKm = 25) {
    const search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radiusKm: String(radiusKm),
    });

    return request<NearbyWorker[]>(`/workers/nearby?${search.toString()}`);
  },

  onboard(payload: {
    skills: string[];
    workLatitude?: number;
    workLongitude?: number;
    workAddress?: string;
  }) {
    return request<User>("/workers/me/onboarding", {
      method: "POST",
      body: payload,
    }).then(normalizeUser);
  },

  getAssignments() {
    return request<Issue[]>("/workers/me/assignments").then((issues) =>
      issues.map(normalizeIssue),
    );
  },

  submitReport(
    issueId: number,
    payload: { note: string; status: string; imageUrl?: string | null },
  ) {
    return request<WorkerReport>(`/workers/issues/${issueId}/reports`, {
      method: "POST",
      body: payload,
    }).then(normalizeWorkerReport);
  },
};

export const adminApi = {
  getStats() {
    return request<AdminStats>("/admin/stats");
  },
};

export const uploadApi = {
  upload(base64Image: string, mimeType: string) {
    return request<UploadResponse>("/upload", {
      method: "POST",
      body: { base64Image, mimeType },
    }).then((response) => ({
      imageUrl: normalizeAssetUrl(response.imageUrl) ?? response.imageUrl,
    }));
  },
};

export const classifyApi = {
  classify(imageUrl: string) {
    return request<ClassificationResult>("/classify", {
      method: "POST",
      body: { imageUrl },
    });
  },
};
