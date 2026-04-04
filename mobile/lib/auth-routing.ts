import type { User } from "@/lib/api";

export function getPostAuthRoute(user: User): string {
  if (user.role === "admin") {
    return "/admin";
  }

  if (user.role === "worker") {
    if (!user.workerVerified) {
      return "/worker/verify";
    }

    return user.onboardingCompleted ? "/worker" : "/worker/onboarding";
  }

  return "/(tabs)";
}
