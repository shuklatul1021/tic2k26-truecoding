import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { WorkerPageFrame } from "@/components/worker/WorkerPageFrame";
import { useAuth } from "@/context/AuthContext";
import { workersApi } from "@/lib/api";

export default function WorkerProfileScreen() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["worker-assignments"],
    queryFn: workersApi.getAssignments,
  });

  const metrics = useMemo(
    () => [
      {
        label: "Accepted jobs",
        value: (data ?? []).filter((issue) => issue.assignmentResponseStatus === "accepted").length,
        icon: "check-circle",
        color: Colors.success,
        bg: Colors.successLight,
      },
      {
        label: "Awaiting reply",
        value: (data ?? []).filter((issue) => (issue.assignmentResponseStatus ?? "pending") === "pending").length,
        icon: "clock",
        color: Colors.primary,
        bg: Colors.primaryLight,
      },
      {
        label: "Points",
        value: user?.pointsBalance ?? 0,
        icon: "award",
        color: Colors.warning,
        bg: Colors.warningLight,
      },
      {
        label: "Wallet",
        value: `Rs ${Number(user?.walletBalance ?? 0).toFixed(2)}`,
        icon: "credit-card",
        color: Colors.accent,
        bg: "#FFF6D9",
      },
    ],
    [data, user?.pointsBalance, user?.walletBalance],
  );

  return (
    <WorkerPageFrame
      eyebrow="Worker profile"
      title="Your field account"
      subtitle="Track your readiness, rewards, and assignment load with the same platform styling used across the rest of the app."
    >
      <View style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || "W"}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{user?.name || "Worker"}</Text>
          <Text style={styles.email}>{user?.email || "No email available"}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Feather name="briefcase" size={14} color={Colors.warning} />
          <Text style={styles.roleText}>Worker</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: metric.bg }]}>
              <Feather name={metric.icon as never} size={16} color={metric.color} />
            </View>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick actions</Text>
        <Text style={styles.panelSubtitle}>
          Open the assignment queue to accept new work or send a verified progress update after you start field work.
        </Text>

        <Pressable style={styles.actionCard} onPress={() => router.push("/worker")}>
          <View style={styles.actionIconWrap}>
            <Feather name="list" size={18} color={Colors.warning} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Go to assignments</Text>
            <Text style={styles.actionSubtitle}>Review assigned issues and manage responses</Text>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.warning} />
        </Pressable>
      </View>
    </WorkerPageFrame>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.warning,
  },
  identityCopy: {
    flex: 1,
    minWidth: 180,
  },
  name: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  email: {
    marginTop: 3,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.warningLight,
  },
  roleText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: "700" as const,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 130,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 6,
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "700" as const,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  panelSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  actionCard: {
    marginTop: 4,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.warningLight,
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  actionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
});
