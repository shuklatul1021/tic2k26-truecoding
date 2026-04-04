import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator, Alert, Platform, TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { issuesApi, workersApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatDateTimeInput, formatTime, getCategoryLabel, getPriorityLabel, getStatusLabel } from "@/lib/utils";

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showBefore, setShowBefore] = useState(true);
  const [dueAt, setDueAt] = useState("");

  const { data: issue, isLoading } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => issuesApi.getById(parseInt(id)),
  });

  const upvoteMutation = useMutation({
    mutationFn: () => issuesApi.upvote(parseInt(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", id] });
      qc.invalidateQueries({ queryKey: ["issues"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { workerId: number; workerName: string }) =>
      issuesApi.update(parseInt(id), {
        assignedWorkerId: payload.workerId,
        assignedTo: payload.workerName,
        dueAt: dueAt || null,
        note: `Assigned to ${payload.workerName}`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", id] });
      qc.invalidateQueries({ queryKey: ["issues"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: "in_progress" | "resolved") =>
      issuesApi.update(parseInt(id), { status, dueAt: dueAt || issue?.dueAt || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", id] });
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const { data: nearbyWorkers } = useQuery({
    queryKey: ["nearby-workers", issue?.id],
    queryFn: () => workersApi.getNearby(issue!.latitude, issue!.longitude),
    enabled: user?.role === "admin" && !!issue,
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: Colors.textSecondary }}>Issue not found</Text>
      </View>
    );
  }

  const priorityColor = { high: Colors.priorityHigh, medium: Colors.priorityMedium, low: Colors.priorityLow }[issue.priority];
  const priorityBg = { high: Colors.priorityHighBg, medium: Colors.priorityMediumBg, low: Colors.priorityLowBg }[issue.priority];
  const statusColor = { pending: Colors.statusPending, in_progress: Colors.statusInProgress, resolved: Colors.statusResolved }[issue.status];
  const statusBg = { pending: Colors.statusPendingBg, in_progress: Colors.statusInProgressBg, resolved: Colors.statusResolvedBg }[issue.status];

  const timelineIconColor = {
    pending: Colors.statusPending,
    in_progress: Colors.statusInProgress,
    resolved: Colors.statusResolved,
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: showBefore ? issue.imageUrl : (issue.resolvedImageUrl || issue.imageUrl) }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        {issue.resolvedImageUrl && (
          <View style={styles.imageToggle}>
            <Pressable
              style={[styles.toggleBtn, showBefore && styles.toggleBtnActive]}
              onPress={() => setShowBefore(true)}
            >
              <Text style={[styles.toggleText, showBefore && styles.toggleTextActive]}>Before</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, !showBefore && styles.toggleBtnActive]}
              onPress={() => setShowBefore(false)}
            >
              <Text style={[styles.toggleText, !showBefore && styles.toggleTextActive]}>After</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: priorityBg }]}>
            <Text style={[styles.badgeText, { color: priorityColor }]}>{getPriorityLabel(issue.priority)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusBg }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{getStatusLabel(issue.status)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getCategoryLabel(issue.category)}</Text>
          </View>
        </View>

        <Text style={styles.title}>{issue.title}</Text>
        <Text style={styles.description}>{issue.description}</Text>

        <View style={styles.metaRow}>
          <Feather name="user" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>Reported by <Text style={styles.metaHighlight}>{issue.userName}</Text></Text>
        </View>

        {issue.address && (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={2}>{issue.address}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <Feather name="calendar" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{formatDate(issue.createdAt)} at {formatTime(issue.createdAt)}</Text>
        </View>

        {issue.assignedTo && (
          <View style={styles.metaRow}>
            <Feather name="briefcase" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>Assigned to: <Text style={styles.metaHighlight}>{issue.assignedTo}</Text></Text>
          </View>
        )}

        {issue.confidenceScore != null && (
          <View style={styles.aiChip}>
            <Feather name="zap" size={13} color={Colors.secondary} />
            <Text style={styles.aiText}>AI classified | {Math.round(issue.confidenceScore * 100)}% confidence</Text>
          </View>
        )}

        {issue.verificationSummary && (
          <View
            style={[
              styles.verificationCard,
              issue.verificationStatus === "rejected" ? styles.verificationCardRejected : styles.verificationCardVerified,
            ]}
          >
            <Text style={styles.verificationTitle}>Verification</Text>
            <Text style={styles.verificationText}>{issue.verificationSummary}</Text>
            <Text style={styles.verificationText}>
              Real image: {issue.isRealImage ? "Yes" : "No"} | Detected: {issue.detected ? "Yes" : "No"}
            </Text>
            <Text style={styles.verificationText}>
              Authenticity: {Math.round((issue.authenticityConfidence ?? issue.authenticityScore ?? 0) * 100)}% | Confidence: {Math.round((issue.confidenceScore ?? 0) * 100)}%
            </Text>
            <Text style={styles.verificationText}>
              Coverage: {Math.round(issue.coveragePercentage ?? 0)}% | Density: {Number(issue.densityScore ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.verificationText}>
              Image shows: {issue.imageSubject || "Unknown"}
            </Text>
            <Text style={styles.verificationText}>
              Authenticity note: {issue.authenticityExplanation || "No authenticity note"}
            </Text>
            <Text style={styles.verificationText}>
              Explanation: {issue.explanation || issue.verificationSummary}
            </Text>
            <Text style={styles.verificationText}>
              Location: {issue.locationVerified ? "matched" : "not matched"}
            </Text>
          </View>
        )}

        {(issue.rewardPoints || issue.workerPoints || issue.workerBonusPoints) ? (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardTitle}>Rewards</Text>
            <Text style={styles.rewardText}>Citizen reward: {issue.rewardPoints ?? 0} pts</Text>
            <Text style={styles.rewardText}>Worker reward: {issue.workerPoints ?? 0} pts</Text>
            <Text style={styles.rewardText}>Worker bonus: {issue.workerBonusPoints ?? 0} pts</Text>
          </View>
        ) : null}

        {user?.role === "admin" && (
          <View style={styles.adminPanel}>
            <Text style={styles.sectionTitle}>Admin Assignment</Text>
            <TextInput
              style={styles.deadlineInput}
              value={dueAt}
              onChangeText={setDueAt}
              placeholder={formatDateTimeInput(issue.dueAt) || "YYYY-MM-DDTHH:mm"}
              placeholderTextColor={Colors.placeholder}
            />
            <View style={styles.quickActions}>
              <Pressable style={styles.actionPill} onPress={() => statusMutation.mutate("in_progress")}>
                <Text style={styles.actionPillText}>Mark In Progress</Text>
              </Pressable>
              <Pressable style={styles.actionPill} onPress={() => statusMutation.mutate("resolved")}>
                <Text style={styles.actionPillText}>Mark Resolved</Text>
              </Pressable>
            </View>
            <Text style={styles.workerSectionTitle}>Nearby Workers</Text>
            {(nearbyWorkers ?? []).map((worker) => (
              <View key={worker.id} style={styles.workerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerMeta}>
                    {worker.distanceKm?.toFixed(1)} km away | {(worker.skills ?? []).join(", ")}
                  </Text>
                </View>
                <Pressable
                  style={styles.assignBtn}
                  onPress={() => assignMutation.mutate({ workerId: worker.id, workerName: worker.name })}
                >
                  <Text style={styles.assignBtnText}>Assign</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={[styles.upvoteBtn, issue.hasUpvoted && styles.upvoteBtnActive]}
          onPress={() => user ? upvoteMutation.mutate() : router.push("/auth/login")}
          disabled={upvoteMutation.isPending}
        >
          <Ionicons
            name={issue.hasUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"}
            size={22}
            color={issue.hasUpvoted ? "#fff" : Colors.primary}
          />
          <Text style={[styles.upvoteText, issue.hasUpvoted && { color: "#fff" }]}>
            {issue.upvotes} {issue.upvotes === 1 ? "upvote" : "upvotes"}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.timeline}>
          {(issue.timeline ?? []).map((event, idx) => {
            const isFirst = idx === 0;
            const color = (timelineIconColor as any)[event.status] || Colors.textSecondary;
            return (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: color }]} />
                  {idx < (issue.timeline?.length ?? 0) - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{getStatusLabel(event.status)}</Text>
                  {event.note && <Text style={styles.timelineNote}>{event.note}</Text>}
                  {event.createdBy && <Text style={styles.timelineBy}>by {event.createdBy}</Text>}
                  <Text style={styles.timelineDate}>{formatDate(event.createdAt)} | {formatTime(event.createdAt)}</Text>
                </View>
              </View>
            );
          })}
          {(issue.timeline?.length ?? 0) === 0 && (
            <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>No timeline events yet</Text>
          )}
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Worker Daily Reports</Text>
        {(issue.workerReports ?? []).map((report) => (
          <View key={report.id} style={styles.reportCard}>
            <Text style={styles.reportTitle}>{report.workerName || "Worker"} | {report.status.replace(/_/g, " ")}</Text>
            <Text style={styles.reportBody}>{report.note}</Text>
            <Text style={styles.reportMeta}>{report.imageVerificationSummary || "Image verification pending"}</Text>
            <Text style={styles.reportMeta}>{formatDate(report.createdAt)} | {formatTime(report.createdAt)}</Text>
          </View>
        ))}
        {(issue.workerReports?.length ?? 0) === 0 && (
          <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>No worker reports yet</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageContainer: { position: "relative" },
  heroImage: { width: "100%", height: 260, backgroundColor: Colors.borderLight },
  imageToggle: {
    position: "absolute", bottom: 12, right: 12,
    flexDirection: "row", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, overflow: "hidden",
  },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" as const },
  toggleTextActive: { color: "#fff" },
  content: { padding: 20 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: Colors.background,
  },
  badgeText: { fontSize: 12, fontWeight: "600" as const, color: Colors.textSecondary },
  title: { fontSize: 22, fontWeight: "700" as const, color: Colors.text, marginBottom: 10, lineHeight: 30 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  metaText: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  metaHighlight: { fontWeight: "600" as const, color: Colors.text },
  aiChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start", marginTop: 8,
  },
  verificationCard: { borderRadius: 16, padding: 14, marginTop: 14, gap: 4, borderWidth: 1 },
  verificationCardVerified: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  verificationCardRejected: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger },
  verificationTitle: { fontSize: 14, fontWeight: "700" as const, color: Colors.primary },
  verificationText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  rewardCard: { backgroundColor: Colors.warningLight, borderRadius: 16, padding: 14, marginTop: 14, gap: 4 },
  rewardTitle: { fontSize: 14, fontWeight: "700" as const, color: Colors.warning },
  rewardText: { fontSize: 13, color: Colors.textSecondary },
  adminPanel: { marginTop: 18, gap: 10 },
  deadlineInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.text,
  },
  quickActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionPill: { backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  actionPillText: { color: Colors.primary, fontWeight: "700" as const, fontSize: 13 },
  workerSectionTitle: { fontSize: 15, fontWeight: "700" as const, color: Colors.text, marginTop: 4 },
  workerRow: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 12 },
  workerName: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  workerMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  assignBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  assignBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 13 },
  aiText: { fontSize: 13, color: Colors.secondary, fontWeight: "500" as const },
  upvoteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: Colors.primary,
  },
  upvoteBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  upvoteText: { fontSize: 16, fontWeight: "600" as const, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text, marginBottom: 16 },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: "row", gap: 12 },
  timelineLeft: { alignItems: "center", width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineStatus: { fontSize: 15, fontWeight: "600" as const, color: Colors.text },
  timelineNote: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  timelineBy: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  timelineDate: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  reportCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 10 },
  reportTitle: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  reportBody: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, lineHeight: 20 },
  reportMeta: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
});
