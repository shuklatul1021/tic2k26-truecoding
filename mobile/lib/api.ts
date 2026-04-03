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
    throw new Error(errorMessage);
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

export interface Issue {
  id: number;
  title: string;
  description: string;
  category: "garbage" | "pothole" | "water_leakage" | "other";
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "resolved";
  imageUrl: string;
  resolvedImageUrl?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  upvotes: number;
  hasUpvoted: boolean;
  userId: number;
  userName: string;
  assignedTo?: string | null;
  assignedWorkerId?: number | null;
  assignedWorkerName?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  confidenceScore?: number | null;
  verificationStatus?: "pending" | "verified" | "rejected";
  verificationSummary?: string | null;
  authenticityScore?: number | null;
  locationVerified?: boolean;
  imageSource?: "camera" | "gallery";
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

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<{ token: string; user: User }>("/auth/register", data),
  registerAdmin: (data: { name: string; email: string; password: string }) =>
    api.post<{ token: string; user: User }>("/auth/register-admin", data),
  workerRegister: (data: { name: string; email: string; aadhaarNumber: string }) =>
    api.post<{ token: string; user: User }>("/auth/worker-register", data),
  workerLogin: (data: { email: string; aadhaarNumber: string }) =>
    api.post<{ token: string; user: User }>("/auth/worker-login", data),
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>("/auth/login", data),
  me: () => api.get<User>("/auth/me"),
};

export const issuesApi = {
  getAll: (params?: { status?: string; priority?: string; category?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.category) qs.set("category", params.category);
    if (params?.page) qs.set("page", String(params.page));
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
    imageSource: "camera" | "gallery";
    captureLatitude?: number;
    captureLongitude?: number;
  }) => api.post<IssueDetail>("/issues", data),
  verifyImage: (data: { imageUrl: string; imageSource: "camera" | "gallery" }) =>
    api.post<{
      accepted: boolean;
      verificationSummary: string;
      authenticityScore: number;
      confidenceScore: number;
    }>("/issues/verify-image", data),
  update: (
    id: number,
    data: {
      status?: string;
      priority?: string;
      assignedTo?: string;
      assignedWorkerId?: number | null;
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
    api.post<{ category: string; priority: string; confidence: number; description: string }>(
      "/classify",
      { imageUrl },
    ),
};
