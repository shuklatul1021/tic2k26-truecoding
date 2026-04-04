import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { AdminPageFrame } from "@/components/admin/AdminPageFrame";
import { IssueCard } from "@/components/IssueCard";
import { adminApi, issuesApi, type AdminStats, type IssuePriority, type IssueStatus } from "@/lib/api";
import { getStatusLabel } from "@/lib/utils";

const statusFilterMap: Record<string, IssueStatus | undefined> = {
  All: undefined,
  Pending: "pending",
  "In Progress": "in_progress",
  Resolved: "resolved",
};

const priorityFilterMap: Record<string, IssuePriority | undefined> = {
  All: undefined,
  High: "high",
  Medium: "medium",
  Low: "low",
};

const statusOptions: IssueStatus[] = ["pending", "in_progress", "resolved"];
type QueueView = "issues" | "resolved";

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [queueView, setQueueView] = useState<QueueView>("issues");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
  });

  const statusParam = queueView === "resolved" ? "resolved" : statusFilterMap[statusFilter];
  const priorityParam = priorityFilterMap[priorityFilter];

  const { data, isLoading } = useQuery({
    queryKey: ["issues", statusParam, priorityParam],
    queryFn: () => issuesApi.getAll({ status: statusParam, priority: priorityParam }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: IssueStatus }) =>
      issuesApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const statCards = useMemo(
    () => [
      { label: "Total issues", value: stats?.totalIssues ?? 0, color: Colors.primary, icon: "activity" },
      { label: "Pending", value: stats?.pendingIssues ?? 0, color: Colors.statusPending, icon: "clock" },
      { label: "In progress", value: stats?.inProgressIssues ?? 0, color: Colors.statusInProgress, icon: "loader" },
      { label: "Resolved", value: stats?.resolvedIssues ?? 0, color: Colors.statusResolved, icon: "check-circle" },
    ],
    [stats],
  );

  const snapshotCards = useMemo(
    () => [
      {
        label: "Resolution rate",
        value: `${stats?.resolutionRate ?? 0}%`,
        helper: "Closed from total reported issues",
        color: Colors.secondary,
        icon: "trending-up",
      },
      {
        label: "High priority",
        value: stats?.highPriorityIssues ?? 0,
        helper: "Urgent cases needing attention",
        color: Colors.danger,
        icon: "alert-triangle",
      },
      {
        label: "Community users",
        value: stats?.totalUsers ?? 0,
        helper: "Citizens currently using the platform",
        color: Colors.primary,
        icon: "users",
      },
    ],
    [stats],
  );

  const visibleIssues = useMemo(
    () =>
      (data?.issues ?? []).filter((issue) => (queueView === "resolved" ? issue.status === "resolved" : issue.status !== "resolved")),
    [data?.issues, queueView],
  );

  return (
    <AdminPageFrame
      eyebrow="Admin home"
      title="Overview and issue tracking"
      subtitle="Watch queue health, monitor priorities, and move issues through the workflow from one place."
    >
      <View style={styles.snapshotRow}>
        {snapshotCards.map((card) => (
          <View key={card.label} style={styles.snapshotCard}>
            <View style={[styles.snapshotIconWrap, { backgroundColor: `${card.color}16` }]}>
              <Feather name={card.icon as never} size={18} color={card.color} />
            </View>
            <Text style={styles.snapshotValue}>{card.value}</Text>
            <Text style={styles.snapshotLabel}>{card.label}</Text>
            <Text style={styles.snapshotHelper}>{card.helper}</Text>
          </View>
        ))}
      </View>

      <View style={styles.statsGrid}>
        {statCards.map((card) => (
          <View key={card.label} style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: `${card.color}14` }]}>
              <Feather name={card.icon as never} size={18} color={card.color} />
            </View>
            <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>{queueView === "resolved" ? "Resolved queue" : "Issue queue"}</Text>
        <Text style={styles.sectionSubtitle}>
          {queueView === "resolved"
            ? "Review closed issues here. Resolved items stay out of the active issue queue."
            : "Filter the active queue and move pending work through the workflow from the admin home tab."}
        </Text>

        {queueView === "issues" ? (
          <>
            <Text style={styles.filterLabel}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
              {["All", "Pending", "In Progress"].map((filter) => (
                <Pressable
                  key={filter}
                  style={[styles.chip, statusFilter === filter && styles.chipActive]}
                  onPress={() => setStatusFilter(filter)}
                >
                  <Text style={[styles.chipText, statusFilter === filter && styles.chipTextActive]}>{filter}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={[styles.filterLabel, { marginTop: 12 }]}>Priority</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          {["All", "High", "Medium", "Low"].map((filter) => (
            <Pressable
              key={filter}
              style={[styles.chip, priorityFilter === filter && styles.chipActive]}
              onPress={() => setPriorityFilter(filter)}
            >
              <Text style={[styles.chipText, priorityFilter === filter && styles.chipTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.issueSectionHeader}>
        <View style={styles.queueToggle}>
          <Pressable style={[styles.queueToggleBtn, queueView === "issues" && styles.queueToggleBtnActive]} onPress={() => setQueueView("issues")}>
            <Text style={[styles.queueToggleText, queueView === "issues" && styles.queueToggleTextActive]}>Issues</Text>
          </Pressable>
          <Pressable style={[styles.queueToggleBtn, queueView === "resolved" && styles.queueToggleBtnActive]} onPress={() => setQueueView("resolved")}>
            <Text style={[styles.queueToggleText, queueView === "resolved" && styles.queueToggleTextActive]}>Resolved</Text>
          </Pressable>
        </View>
        <View style={styles.issueCountPill}>
          <Text style={styles.issueCountText}>{visibleIssues.length}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : visibleIssues.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={34} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>{queueView === "resolved" ? "No resolved issues match this filter" : "No active issues match this filter"}</Text>
          <Text style={styles.emptyText}>
            {queueView === "resolved"
              ? "Adjust the priority filter to inspect another part of the resolved list."
              : "Adjust the status or priority filters to inspect another part of the active queue."}
          </Text>
        </View>
      ) : (
        visibleIssues.map((issue) => (
          <View key={issue.id}>
            <IssueCard issue={issue} onPress={() => router.push(`/issue/${issue.id}`)} />
            {queueView === "issues" ? (
              <View style={styles.adminActions}>
                {statusOptions.map((status) => {
                  if (status === issue.status || status === "resolved" && issue.status === "resolved") return null;

                  const label = getStatusLabel(status);
                  const color = {
                    pending: Colors.statusPending,
                    in_progress: Colors.statusInProgress,
                    resolved: Colors.statusResolved,
                  }[status];

                  return (
                    <Pressable
                      key={status}
                      style={[styles.actionBtn, { borderColor: color ?? Colors.border }]}
                      onPress={() => updateMutation.mutate({ id: issue.id, status })}
                      disabled={updateMutation.isPending}
                    >
                      <Text style={[styles.actionBtnText, { color }]}>Set {label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ))
      )}
    </AdminPageFrame>
  );
}

const styles = StyleSheet.create({
  snapshotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  snapshotCard: {
    flexGrow: 1,
    flexBasis: 132,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 5,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  snapshotIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  snapshotValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  snapshotLabel: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  snapshotHelper: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 108,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 11,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800" as const,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "700" as const,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 13,
    gap: 9,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  filterRail: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "700" as const,
  },
  chipTextActive: {
    color: Colors.textInverse,
  },
  issueSectionHeader: {
    marginTop: 2,
    marginHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  queueToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
  },
  queueToggleBtn: {
    minWidth: 94,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  queueToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  queueToggleText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: Colors.textSecondary,
  },
  queueToggleTextActive: {
    color: Colors.textInverse,
  },
  issueCountPill: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
  },
  issueCountText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "800" as const,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },
  adminActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: Colors.surface,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  emptyState: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
