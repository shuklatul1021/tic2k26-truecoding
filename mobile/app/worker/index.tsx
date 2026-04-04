import React, { useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { WorkerPageFrame } from "@/components/worker/WorkerPageFrame";
import { useAuth } from "@/context/AuthContext";
import { workersApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function WorkerDashboardScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["worker-assignments"],
    queryFn: workersApi.getAssignments,
  });

  const assignmentDecisionMutation = useMutation({
    mutationFn: ({ issueId, decision }: { issueId: number; decision: "accepted" | "rejected" }) =>
      workersApi.respondToAssignment(issueId, decision),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["worker-assignments"] });
      qc.invalidateQueries({ queryKey: ["issue", variables.issueId] });
    },
    onError: (error: Error) => {
      Alert.alert("Could not update assignment", error.message);
    },
  });

  const assignmentMetrics = useMemo(() => {
    const assignments = data ?? [];
    return [
      {
        label: "Open assignments",
        value: assignments.length,
        icon: "briefcase",
        tone: Colors.warning,
        bg: Colors.warningLight,
      },
      {
        label: "Accepted",
        value: assignments.filter((issue) => issue.assignmentResponseStatus === "accepted").length,
        icon: "check-circle",
        tone: Colors.success,
        bg: Colors.successLight,
      },
      {
        label: "Pending reply",
        value: assignments.filter((issue) => (issue.assignmentResponseStatus ?? "pending") === "pending").length,
        icon: "clock",
        tone: Colors.primary,
        bg: Colors.primaryLight,
      },
      {
        label: "Wallet",
        value: `Rs ${Number(user?.walletBalance ?? 0).toFixed(0)}`,
        icon: "credit-card",
        tone: Colors.accent,
        bg: "#FFF6D9",
      },
    ];
  }, [data, user?.walletBalance]);

  function handleAssignmentDecision(issueId: number, decision: "accepted" | "rejected") {
    assignmentDecisionMutation.mutate({ issueId, decision });
  }

  return (
    <WorkerPageFrame
      eyebrow="Worker home"
      title="Assignments, schedule, and field updates"
      subtitle="Review what is assigned to you, confirm work quickly, and keep progress reporting in one consistent workspace."
    >
      <View style={styles.metricsGrid}>
        {assignmentMetrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: metric.bg }]}>
              <Feather name={metric.icon as never} size={17} color={metric.tone} />
            </View>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.sectionTitle}>Assigned issues</Text>
            <Text style={styles.sectionSubtitle}>
              Accept assignments before sending work updates. Rejected items go back to the admin queue.
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{data?.length ?? 0}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.warning} />
          </View>
        ) : (data?.length ?? 0) === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather name="inbox" size={28} color={Colors.warning} />
            </View>
            <Text style={styles.emptyTitle}>No assignments yet</Text>
            <Text style={styles.emptyText}>New field work assigned by admins will appear here.</Text>
          </View>
        ) : (
          <View style={styles.assignmentList}>
            {(data ?? []).map((issue) => {
              const assignmentState = issue.assignmentResponseStatus ?? "pending";
              const isAccepted = assignmentState === "accepted";
              const isReadOnly = issue.status === "closed" || issue.status === "resolved";
              const isDecisionPending = assignmentDecisionMutation.isPending;

              return (
                <View key={issue.id} style={styles.issueCard}>
                  <View style={styles.issueTopRow}>
                    <View style={styles.issueTitleWrap}>
                      <Text style={styles.issueTitle}>{issue.title}</Text>
                      <Text style={styles.issueAddress}>{issue.address || "Address not added yet"}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        isAccepted ? styles.statusPillAccepted : styles.statusPillPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isAccepted ? styles.statusPillTextAccepted : styles.statusPillTextPending,
                        ]}
                      >
                        {isAccepted ? "Accepted" : "Awaiting reply"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Issue status</Text>
                      <Text style={styles.metaValue}>{issue.status.replace(/_/g, " ")}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Start</Text>
                      <Text style={styles.metaValue}>{issue.assignmentStartAt ? formatDateTime(issue.assignmentStartAt) : "Not set"}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Due</Text>
                      <Text style={styles.metaValue}>{issue.dueAt ? formatDateTime(issue.dueAt) : "Not set"}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Reward</Text>
                      <Text style={styles.metaValue}>
                        {issue.workerPoints ?? 0} pts + {issue.workerBonusPoints ?? 0} bonus
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/issue/${issue.id}`)}>
                      <Text style={styles.secondaryBtnText}>Open issue</Text>
                    </Pressable>

                    {isAccepted ? (
                      isReadOnly ? (
                        <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/issue/${issue.id}`)}>
                          <Text style={styles.secondaryBtnText}>View history</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.primaryBtn}
                          onPress={() => router.push(`/worker/report/${issue.id}` as never)}
                        >
                          <Text style={styles.primaryBtnText}>Send update</Text>
                        </Pressable>
                      )
                    ) : (
                      <>
                        <Pressable
                          style={[styles.rejectBtn, isDecisionPending && styles.buttonDisabled]}
                          onPress={() => handleAssignmentDecision(issue.id, "rejected")}
                          disabled={isDecisionPending}
                        >
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.acceptBtn, isDecisionPending && styles.buttonDisabled]}
                          onPress={() => handleAssignmentDecision(issue.id, "accepted")}
                          disabled={isDecisionPending}
                        >
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </WorkerPageFrame>
  );
}

const styles = StyleSheet.create({
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 115,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
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
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    maxWidth: 280,
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.warningLight,
  },
  countBadgeText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: "800" as const,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 18,
    gap: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.warningLight,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    color: Colors.textSecondary,
  },
  assignmentList: {
    gap: 10,
  },
  issueCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 14,
    gap: 12,
  },
  issueTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  issueTitleWrap: {
    flex: 1,
    gap: 4,
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  issueAddress: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillPending: {
    backgroundColor: Colors.primaryLight,
  },
  statusPillAccepted: {
    backgroundColor: Colors.successLight,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800" as const,
  },
  statusPillTextPending: {
    color: Colors.primary,
  },
  statusPillTextAccepted: {
    color: Colors.success,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: {
    flexGrow: 1,
    flexBasis: 132,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    padding: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "700" as const,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  secondaryBtn: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  primaryBtn: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.warning,
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  rejectBtn: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: "#F3C4C4",
  },
  rejectBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  acceptBtn: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: Colors.warning,
  },
  acceptBtnText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
