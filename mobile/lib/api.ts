import Constants from "expo-constants";
import { Platform } from "react-native";

function normalizeApiBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function getDefaultApiBaseUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.191.110.101:3001/api";
  }

  return "http://10.191.110.101:3001/api";
}

const configuredBackendUrl =
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) ||
  process.env.EXPO_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_API_URL;

const BASE_URL = normalizeApiBaseUrl(configuredBackendUrl || getDefaultApiBaseUrl());

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof data === "string"
        ? data
        : data?.message || data?.error || `Request failed (${response.status})`;
    const error = new Error(errorMessage) as Error & { data?: unknown; status?: number };
    error.data = typeof data === "string" ? undefined : data;
    error.status = response.status;
    throw error;
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin" | "worker";
  createdAt: string;
  issuesReported?: number;
  issuesResolved?: number;
  pointsBalance?: number;
  walletBalance?: number;
  onboardingCompleted?: boolean;
  workerVerified?: boolean;
}

export interface TimelineEvent {
  id: number;
  issueId: number;
  status: string;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface WorkerReport {
  id: number;
  issueId: number;
  workerId: number;
  workerName?: string;
  note: string;
  status: string;
  imageUrl?: string | null;
  imageVerificationStatus: string;
  imageVerificationSummary?: string | null;
  createdAt: string;
}

export type IssueCategory = "garbage" | "pothole" | "water_leakage" | "other";
export type IssuePriority = "high" | "medium" | "low";
export type IssueStatus = "pending" | "in_progress" | "resolved";
export type ImageSource = "camera" | "gallery";

export interface VerificationDetails {
  accepted: boolean;
  verificationStatus: "verified" | "rejected";
  verificationSummary: string;
  authenticityScore: number;
  confidenceScore: number;
  authenticityConfidence: number;
  authenticityExplanation: string;
  confidence: number;
  coveragePercentage: number;
  densityScore: number;
  detected: boolean;
  explanation: string;
  isRealImage: boolean;
  imageSubject: string;
  category: IssueCategory;
  priority: IssuePriority;
  aiDescription: string;
  locationVerified: boolean;
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
  distanceKm?: number | null;
  address?: string | null;
  upvotes: number;
  hasUpvoted: boolean;
  userId: number;
  userName: string;
  assignedTo?: string | null;
  assignedWorkerId?: number | null;
  assignedWorkerName?: string | null;
  assignedWorkerRoleTitle?: string | null;
  assignmentStartAt?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  confidenceScore?: number | null;
  verificationStatus?: "pending" | "verified" | "rejected";
  verificationSummary?: string | null;
  authenticityScore?: number | null;
  authenticityConfidence?: number | null;
  authenticityExplanation?: string | null;
  coveragePercentage?: number | null;
  densityScore?: number | null;
  detected?: boolean | null;
  explanation?: string | null;
  isRealImage?: boolean | null;
  imageSubject?: string | null;
  locationVerified?: boolean;
  imageSource?: ImageSource;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
  rewardPoints?: number;
  workerPoints?: number;
  workerBonusPoints?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IssueDetail extends Issue {
  timeline: TimelineEvent[];
  workerReports?: WorkerReport[];
  latestWorkerReportStatus?: string | null;
  workerMarkedResolvedAt?: string | null;
  canAdminMarkResolved?: boolean;
  inProgressLockedUntil?: string | null;
}

export interface MapIssue {
  id: number;
  title: string;
  category: Issue["category"];
  priority: Issue["priority"];
  status: Issue["status"];
  latitude: number;
  longitude: number;
  upvotes: number;
}

export interface IssuesResponse {
  issues: Issue[];
  total: number;
  page: number;
  totalPages: number;
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

export interface WorkerProfile {
  id: number;
  name: string;
  email: string;
  role?: "worker";
  roleTitle?: string | null;
  pointsBalance: number;
  walletBalance: number;
  skills: string[];
  workLatitude?: number | null;
  workLongitude?: number | null;
  workAddress?: string | null;
  onboardingCompleted: boolean;
  isAvailable: boolean;
  distanceKm?: number;
}

export interface WorkerAccount {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  onboardingCompleted: boolean;
  workerVerified: boolean;
  verifiedAt?: string | null;
  roleTitle?: string | null;
  skills?: string[];
  invitedByAdminId?: number | null;
  invitedByAdminName?: string | null;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<{ token: string; user: User }>("/auth/register", data),
  registerAdmin: (data: { name: string; email: string; password: string }) =>
    api.post<{ token: string; user: User }>("/auth/register-admin", data),
  workerLogin: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>("/auth/worker-login", data),
  verifyWorker: (data: {
    name: string;
    password: string;
    roleTitle: string;
    skills: string[];
    workLatitude?: number;
    workLongitude?: number;
    workAddress?: string;
  }) =>
    api.post<{ user: User }>("/auth/worker-verify", data),
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>("/auth/login", data),
  me: () => api.get<User>("/auth/me"),
};

export const issuesApi = {
  getAll: (params?: {
    status?: string;
    priority?: string;
    category?: string;
    page?: number;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.category) qs.set("category", params.category);
    if (params?.page) qs.set("page", String(params.page));
    if (typeof params?.latitude === "number") qs.set("latitude", String(params.latitude));
    if (typeof params?.longitude === "number") qs.set("longitude", String(params.longitude));
    if (typeof params?.radiusKm === "number") qs.set("radiusKm", String(params.radiusKm));
    const query = qs.toString();
    return api.get<IssuesResponse>(`/issues${query ? `?${query}` : ""}`);
  },
  getMap: () => api.get<MapIssue[]>("/issues/map"),
  getById: (id: number) => api.get<IssueDetail>(`/issues/${id}`),
  create: (data: {
    title: string;
    description: string;
    category?: string;
    priority?: string;
    imageUrl: string;
    latitude: number;
    longitude: number;
    address?: string;
    imageSource: ImageSource;
    captureLatitude?: number;
    captureLongitude?: number;
  }) => api.post<IssueDetail>("/issues", data),
  verifyImage: (data: { imageUrl: string; imageSource: ImageSource }) =>
    api.post<VerificationDetails>("/issues/verify-image", data),
  update: (
    id: number,
    data: {
      status?: string;
      priority?: string;
      assignedTo?: string;
      assignedWorkerId?: number | null;
      assignmentStartAt?: string | null;
      dueAt?: string | null;
      resolvedImageUrl?: string;
      note?: string;
    },
  ) => api.patch<IssueDetail>(`/issues/${id}`, data),
  upvote: (id: number) =>
    api.post<{ upvotes: number; hasUpvoted: boolean }>(`/issues/${id}/upvote`, {}),
  getTimeline: (id: number) => api.get<TimelineEvent[]>(`/issues/${id}/timeline`),
  getUserIssues: (userId: number) => api.get<IssuesResponse>(`/users/${userId}/issues`),
};

export const adminApi = {
  getStats: () => api.get<AdminStats>("/admin/stats"),
  getWorkers: () => api.get<WorkerAccount[]>("/admin/workers"),
  createWorker: (data: {
    name: string;
    email: string;
    password: string;
  }) => api.post<WorkerAccount>("/admin/workers", data),
};

export const workersApi = {
  getNearby: (latitude: number, longitude: number, radiusKm = 25) =>
    api.get<WorkerProfile[]>(
      `/workers/nearby?latitude=${latitude}&longitude=${longitude}&radiusKm=${radiusKm}`,
    ),
  onboard: (data: {
    skills: string[];
    workLatitude?: number;
    workLongitude?: number;
    workAddress?: string;
  }) => api.post<User>("/workers/me/onboarding", data),
  getAssignments: () => api.get<Issue[]>("/workers/me/assignments"),
  submitReport: (
    issueId: number,
    data: { note: string; status: string; imageUrl?: string | null },
  ) => api.post<WorkerReport>(`/workers/issues/${issueId}/reports`, data),
};

export const uploadApi = {
  upload: (base64Image: string, mimeType: string) =>
    api.post<{ imageUrl: string }>("/upload", { base64Image, mimeType }),
};

export const classifyApi = {
  classify: (imageUrl: string) =>
    api.post<{ category: IssueCategory; priority: IssuePriority; confidence: number; description: string }>(
      "/classify",
      { imageUrl },
    ),
};
