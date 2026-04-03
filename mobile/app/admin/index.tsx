import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import {
  adminApi,
  issuesApi,
  type AdminStats,
  type IssuePriority,
  type IssueStatus,
} from "@/lib/api";
import { IssueCard } from "@/components/IssueCard";
import { getStatusLabel } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

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

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const topPadding = Platform.OS === "web" ? 67 : 0;
  const isAdmin = user?.role === "admin";

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
    enabled: isAdmin,
  });

  const statusParam = statusFilterMap[statusFilter];
  const priorityParam = priorityFilterMap[priorityFilter];

  const { data, isLoading } = useQuery({
    queryKey: ["issues", statusParam, priorityParam],
    queryFn: () => issuesApi.getAll({ status: statusParam, priority: priorityParam }),
    enabled: isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: IssueStatus }) =>
      issuesApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center]}>
        <Feather name="shield-off" size={64} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>Access Denied</Text>
        <Text style={styles.emptyText}>Admin privileges required</Text>
      </View>
    );
  }

  const statCards = [
    { label: "Total", value: stats?.totalIssues ?? 0, color: Colors.primary, icon: "activity" },
    { label: "Pending", value: stats?.pendingIssues ?? 0, color: Colors.statusPending, icon: "clock" },
    { label: "In Progress", value: stats?.inProgressIssues ?? 0, color: Colors.statusInProgress, icon: "loader" },
    { label: "Resolved", value: stats?.resolvedIssues ?? 0, color: Colors.statusResolved, icon: "check-circle" },
    { label: "High Priority", value: stats?.highPriorityIssues ?? 0, color: Colors.danger, icon: "alert-triangle" },
    { label: "Resolution %", value: `${stats?.resolutionRate ?? 0}%`, color: Colors.success, icon: "trending-up" },
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.heading}>Admin Dashboard</Text>
          <Text style={styles.subheading}>Manage civic issues</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Feather name="log-out" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        {statCards.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Feather name={s.icon as any} size={18} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.filtersSection}>
        <Text style={styles.filterLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {["All", "Pending", "In Progress", "Resolved"].map((f) => (
            <Pressable
              key={f}
              style={[styles.chip, statusFilter === f && styles.chipActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.chipText, statusFilter === f && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.filterLabel, { marginTop: 12 }]}>Priority</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {["All", "High", "Medium", "Low"].map((f) => (
            <Pressable
              key={f}
              style={[styles.chip, priorityFilter === f && styles.chipActive]}
              onPress={() => setPriorityFilter(f)}
            >
              <Text style={[styles.chipText, priorityFilter === f && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.issuesTitle}>Issues ({data?.total ?? 0})</Text>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        (data?.issues ?? []).map((issue) => (
          <View key={issue.id}>
            <IssueCard
              issue={issue}
              onPress={() => router.push(`/issue/${issue.id}`)}
            />
            <View style={styles.adminActions}>
              {statusOptions.map((status) => {
                if (status === issue.status) return null;
                const label = getStatusLabel(status);
                const color = { pending: Colors.statusPending, in_progress: Colors.statusInProgress, resolved: Colors.statusResolved }[status];
                return (
                  <Pressable
                    key={status}
                    style={[styles.actionBtn, { borderColor: color ?? Colors.border }]}
                    onPress={() => updateMutation.mutate({ id: issue.id, status })}
                    disabled={updateMutation.isPending}
                  >
                    <Text style={[styles.actionBtnText, { color: color }]}>Set {label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: { fontSize: 26, fontWeight: "700" as const, color: Colors.text },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: { fontSize: 14, fontWeight: "700" as const, color: Colors.danger },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  statCard: {
    width: "30%", backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    alignItems: "center", gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: "700" as const },
  statLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: "center" },
  filtersSection: { paddingHorizontal: 16, marginBottom: 16 },
  filterLabel: { fontSize: 14, fontWeight: "600" as const, color: Colors.text, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" as const },
  chipTextActive: { color: "#fff" },
  issuesTitle: { fontSize: 17, fontWeight: "700" as const, color: Colors.text, paddingHorizontal: 16, marginBottom: 4 },
  adminActions: {
    flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4, flexWrap: "wrap",
  },
  actionBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" as const },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
