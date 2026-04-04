import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { DateCalendarModal } from "@/components/admin/DateCalendarModal";
import { issuesApi, workersApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatTime, getCategoryLabel, getPriorityLabel, getStatusLabel } from "@/lib/utils";

type PickerTarget = "start" | "end" | null;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function extractDateValue(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function formatDateChip(value?: string | null) {
  if (!value) return "Select date";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "Select date";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toBoundaryIso(value: string, boundary: "start" | "end") {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const issueId = Number(id);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showBefore, setShowBefore] = useState(true);
  const [assignmentStartDate, setAssignmentStartDate] = useState("");
  const [assignmentEndDate, setAssignmentEndDate] = useState("");
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const { data: issue, isLoading } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => issuesApi.getById(issueId),
    enabled: Number.isFinite(issueId),
  });

  useEffect(() => {
    if (!issue) return;
    setAssignmentStartDate(extractDateValue(issue.assignmentStartAt));
    setAssignmentEndDate(extractDateValue(issue.dueAt));
  }, [issue?.id, issue?.assignmentStartAt, issue?.dueAt]);

  const upvoteMutation = useMutation({
    mutationFn: () => issuesApi.upvote(issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", id] });
      qc.invalidateQueries({ queryKey: ["issues"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { workerId: number; workerName: string }) =>
      issuesApi.update(issueId, {
        assignedWorkerId: payload.workerId,
        assignedTo: payload.workerName,
        assignmentStartAt: toBoundaryIso(assignmentStartDate, "start"),
        dueAt: toBoundaryIso(assignmentEndDate, "end"),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", id] });
      qc.invalidateQueries({ queryKey: ["issues"] });
      Alert.alert("Worker assigned", "Worker and assignment dates were saved.");
    },
    onError: (error: Error) => Alert.alert("Assignment failed", error.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      issuesApi.update(issueId, {
        assignmentStartAt: toBoundaryIso(assignmentStartDate, "start"),
        dueAt: toBoundaryIso(assignmentEndDate, "end"),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", id] });
      qc.invalidateQueries({ queryKey: ["issues"] });
      Alert.alert("Schedule updated", "Assignment dates were updated.");
    },
    onError: (error: Error) => Alert.alert("Schedule update failed", error.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "in_progress" | "resolved") => issuesApi.update(issueId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue", id] });
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: Error) => Alert.alert("Status update failed", error.message),
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
        <Text style={styles.emptyText}>Issue not found</Text>
      </View>
    );
  }

  const priorityColor = { high: Colors.priorityHigh, medium: Colors.priorityMedium, low: Colors.priorityLow }[issue.priority];
  const priorityBg = { high: Colors.priorityHighBg, medium: Colors.priorityMediumBg, low: Colors.priorityLowBg }[issue.priority];
  const statusColor = { pending: Colors.statusPending, in_progress: Colors.statusInProgress, resolved: Colors.statusResolved }[issue.status];
  const statusBg = { pending: Colors.statusPendingBg, in_progress: Colors.statusInProgressBg, resolved: Colors.statusResolvedBg }[issue.status];
  const timelineIconColor = { pending: Colors.statusPending, in_progress: Colors.statusInProgress, resolved: Colors.statusResolved };

  const originalStartDate = extractDateValue(issue.assignmentStartAt);
  const originalEndDate = extractDateValue(issue.dueAt);
  const hasScheduleChanges = assignmentStartDate !== originalStartDate || assignmentEndDate !== originalEndDate;
  const hasCompleteSchedule = Boolean(assignmentStartDate && assignmentEndDate);
  const hasValidScheduleRange = hasCompleteSchedule && assignmentEndDate >= assignmentStartDate;
  const isInProgressLocked = Boolean(issue.inProgressLockedUntil && new Date(issue.inProgressLockedUntil).getTime() > Date.now());
  const canAssignWorker = hasValidScheduleRange;
  const canSaveSchedule = Boolean(issue.assignedWorkerId && hasValidScheduleRange && hasScheduleChanges);
  const canShowUpvote = !user || (user.role === "user" && user.id !== issue.userId);

  function validateSchedule() {
    if (!hasCompleteSchedule) {
      Alert.alert("Missing dates", "Choose both start and end dates.");
      return false;
    }
    if (!hasValidScheduleRange) {
      Alert.alert("Invalid dates", "Start date cannot be after the end date.");
      return false;
    }
    return true;
  }

  function handleAssign(workerId: number, workerName: string) {
    if (!validateSchedule()) return;
    assignMutation.mutate({ workerId, workerName });
  }

  function handleScheduleUpdate() {
    if (!validateSchedule()) return;
    scheduleMutation.mutate();
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: showBefore ? issue.imageUrl : issue.resolvedImageUrl || issue.imageUrl }} style={styles.heroImage} />
          {issue.resolvedImageUrl ? (
            <View style={styles.toggleWrap}>
              <Pressable style={[styles.toggleBtn, showBefore && styles.toggleBtnActive]} onPress={() => setShowBefore(true)}>
                <Text style={[styles.toggleText, showBefore && styles.toggleTextActive]}>Before</Text>
              </Pressable>
              <Pressable style={[styles.toggleBtn, !showBefore && styles.toggleBtnActive]} onPress={() => setShowBefore(false)}>
                <Text style={[styles.toggleText, !showBefore && styles.toggleTextActive]}>After</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: priorityBg }]}><Text style={[styles.badgeText, { color: priorityColor }]}>{getPriorityLabel(issue.priority)}</Text></View>
            <View style={[styles.badge, { backgroundColor: statusBg }]}><Text style={[styles.badgeText, { color: statusColor }]}>{getStatusLabel(issue.status)}</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{getCategoryLabel(issue.category)}</Text></View>
          </View>

          <Text style={styles.title}>{issue.title}</Text>
          <Text style={styles.description}>{issue.description}</Text>

          <View style={styles.metaRow}><Feather name="user" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>Reported by <Text style={styles.metaHighlight}>{issue.userName}</Text></Text></View>
          {issue.address ? <View style={styles.metaRow}><Feather name="map-pin" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>{issue.address}</Text></View> : null}
          <View style={styles.metaRow}><Feather name="calendar" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>{formatDate(issue.createdAt)} at {formatTime(issue.createdAt)}</Text></View>
          {issue.assignedTo ? <View style={styles.metaRow}><Feather name="briefcase" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>Assigned to <Text style={styles.metaHighlight}>{issue.assignedTo}</Text>{issue.assignedWorkerRoleTitle ? ` | ${issue.assignedWorkerRoleTitle}` : ""}</Text></View> : null}
          {issue.assignmentStartAt ? <View style={styles.metaRow}><Feather name="play-circle" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>Start date: {formatDate(issue.assignmentStartAt)}</Text></View> : null}
          {issue.dueAt ? <View style={styles.metaRow}><Feather name="flag" size={14} color={Colors.textSecondary} /><Text style={styles.metaText}>End date: {formatDate(issue.dueAt)}</Text></View> : null}

          {issue.verificationSummary ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Verification</Text>
              <Text style={styles.infoText}>{issue.verificationSummary}</Text>
            </View>
          ) : null}
          {issue.rewardPoints || issue.workerPoints || issue.workerBonusPoints ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Rewards</Text>
              <Text style={styles.infoText}>Citizen reward: {issue.rewardPoints ?? 0} pts</Text>
              <Text style={styles.infoText}>Worker reward: {issue.workerPoints ?? 0} pts</Text>
              <Text style={styles.infoText}>Worker bonus: {issue.workerBonusPoints ?? 0} pts</Text>
            </View>
          ) : null}

          {user?.role === "admin" ? (
            <View style={styles.adminCard}>
              <Text style={styles.sectionTitle}>Admin Assignment</Text>
              <Text style={styles.helperText}>Choose start and end dates, then assign one worker. Reassignment is blocked once someone is assigned.</Text>

              <View style={styles.scheduleRow}>
                <Pressable style={styles.dateCard} onPress={() => setPickerTarget("start")}>
                  <Text style={styles.dateLabel}>Start date</Text>
                  <Text style={styles.dateValue}>{formatDateChip(assignmentStartDate)}</Text>
                </Pressable>
                <Pressable style={styles.dateCard} onPress={() => setPickerTarget("end")}>
                  <Text style={styles.dateLabel}>End date</Text>
                  <Text style={styles.dateValue}>{formatDateChip(assignmentEndDate)}</Text>
                </Pressable>
              </View>

              {canSaveSchedule ? (
                <Pressable style={[styles.saveBtn, scheduleMutation.isPending && styles.buttonDisabled]} onPress={handleScheduleUpdate} disabled={scheduleMutation.isPending}>
                  {scheduleMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update assignment dates</Text>}
                </Pressable>
              ) : null}

              <View style={styles.statusRow}>
                <Pressable
                  style={[styles.statusBtn, (statusMutation.isPending || issue.status === "resolved" || isInProgressLocked) && styles.buttonDisabled]}
                  onPress={() => statusMutation.mutate("in_progress")}
                  disabled={statusMutation.isPending || issue.status === "resolved" || isInProgressLocked}
                >
                  <Text style={styles.statusBtnText}>Mark In Progress</Text>
                </Pressable>
                <Pressable
                  style={[styles.statusBtn, styles.statusBtnResolve, (statusMutation.isPending || issue.status === "resolved" || !issue.canAdminMarkResolved) && styles.buttonDisabled]}
                  onPress={() => statusMutation.mutate("resolved")}
                  disabled={statusMutation.isPending || issue.status === "resolved" || !issue.canAdminMarkResolved}
                >
                  <Text style={styles.statusBtnResolveText}>Confirm Resolved</Text>
                </Pressable>
              </View>

              {isInProgressLocked && issue.inProgressLockedUntil ? <Text style={styles.ruleText}>In-progress can be clicked again after {formatDate(issue.inProgressLockedUntil)}.</Text> : null}
              {!issue.canAdminMarkResolved ? <Text style={styles.ruleText}>Admin can resolve only after the assigned worker sends a resolved report.</Text> : null}

              <View style={styles.workflowBox}>
                <Text style={styles.workflowTitle}>Worker progress gate</Text>
                <Text style={styles.workflowText}>Latest worker update: {issue.latestWorkerReportStatus ? getStatusLabel(issue.latestWorkerReportStatus) : "No worker update yet"}</Text>
                <Text style={styles.workflowText}>Worker resolved at: {issue.workerMarkedResolvedAt ? `${formatDate(issue.workerMarkedResolvedAt)} ${formatTime(issue.workerMarkedResolvedAt)}` : "Pending"}</Text>
              </View>

              <Text style={styles.workerSectionTitle}>Nearby Workers</Text>
              {(nearbyWorkers ?? []).length === 0 ? <Text style={styles.emptyText}>No verified nearby workers found.</Text> : null}
              {(nearbyWorkers ?? []).map((worker) => {
                const assignedElsewhere = Boolean(issue.assignedWorkerId && issue.assignedWorkerId !== worker.id);
                const isAssignedWorker = issue.assignedWorkerId === worker.id;

                return (
                  <View key={worker.id} style={styles.workerRow}>
                    <View style={styles.workerInfo}>
                      <Text style={styles.workerName}>{worker.name}</Text>
                      <Text style={styles.workerMeta}>Role: {worker.role || "worker"} | Title: {worker.roleTitle || "Not set"}</Text>
                      <Text style={styles.workerMeta}>{worker.distanceKm?.toFixed(1)} km away | {(worker.skills ?? []).join(", ") || "No skills listed"}</Text>
                    </View>
                    {isAssignedWorker ? (
                      <View style={styles.assignedPill}><Text style={styles.assignedPillText}>Assigned</Text></View>
                    ) : (
                      <Pressable
                        style={[styles.assignBtn, (!canAssignWorker || assignedElsewhere || assignMutation.isPending) && styles.buttonDisabled]}
                        onPress={() => handleAssign(worker.id, worker.name)}
                        disabled={!canAssignWorker || assignedElsewhere || assignMutation.isPending}
                      >
                        <Text style={styles.assignBtnText}>Assign</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {!hasCompleteSchedule ? <Text style={styles.ruleText}>Pick both dates before assigning a worker.</Text> : null}
              {hasCompleteSchedule && !hasValidScheduleRange ? <Text style={styles.ruleText}>Start date cannot be after the end date.</Text> : null}
            </View>
          ) : null}

          {canShowUpvote ? (
            <Pressable style={[styles.upvoteBtn, issue.hasUpvoted && styles.upvoteBtnActive]} onPress={() => (user ? upvoteMutation.mutate() : router.push("/auth/login"))} disabled={upvoteMutation.isPending}>
              <Ionicons name={issue.hasUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"} size={22} color={issue.hasUpvoted ? "#fff" : Colors.primary} />
              <Text style={[styles.upvoteText, issue.hasUpvoted && { color: "#fff" }]}>{issue.upvotes} {issue.upvotes === 1 ? "upvote" : "upvotes"}</Text>
            </Pressable>
          ) : null}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Timeline</Text>
          {(issue.timeline ?? []).map((event, idx) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: timelineIconColor[event.status as keyof typeof timelineIconColor] || Colors.textSecondary }]} />
                {idx < (issue.timeline?.length ?? 0) - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{getStatusLabel(event.status)}</Text>
                {event.note ? <Text style={styles.timelineNote}>{event.note}</Text> : null}
                {event.createdBy ? <Text style={styles.timelineBy}>by {event.createdBy}</Text> : null}
                <Text style={styles.timelineDate}>{formatDate(event.createdAt)} | {formatTime(event.createdAt)}</Text>
              </View>
            </View>
          ))}
          {(issue.timeline?.length ?? 0) === 0 ? <Text style={styles.emptyText}>No timeline events yet</Text> : null}

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
          {(issue.workerReports?.length ?? 0) === 0 ? <Text style={styles.emptyText}>No worker reports yet</Text> : null}
        </View>
      </ScrollView>

      <DateCalendarModal
        visible={pickerTarget === "start"}
        title="Select Start Date"
        value={assignmentStartDate}
        maxValue={assignmentEndDate || undefined}
        onClose={() => setPickerTarget(null)}
        onSelect={setAssignmentStartDate}
        onClear={() => { setAssignmentStartDate(""); setPickerTarget(null); }}
      />
      <DateCalendarModal
        visible={pickerTarget === "end"}
        title="Select End Date"
        value={assignmentEndDate}
        minValue={assignmentStartDate || undefined}
        onClose={() => setPickerTarget(null)}
        onSelect={setAssignmentEndDate}
        onClear={() => { setAssignmentEndDate(""); setPickerTarget(null); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 40 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageWrap: { position: "relative" },
  heroImage: { width: "100%", height: 260, backgroundColor: Colors.borderLight },
  toggleWrap: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", borderRadius: 20, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.6)" },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" as const },
  toggleTextActive: { color: "#fff" },
  content: { padding: 20 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.background },
  badgeText: { fontSize: 12, fontWeight: "600" as const, color: Colors.textSecondary },
  title: { fontSize: 22, fontWeight: "700" as const, color: Colors.text, lineHeight: 30, marginBottom: 10 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  metaText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  metaHighlight: { color: Colors.text, fontWeight: "600" as const },
  adminCard: { marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  infoCard: { marginTop: 8, padding: 14, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  infoTitle: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  helperText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  scheduleRow: { flexDirection: "row", gap: 10 },
  dateCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  dateLabel: { fontSize: 12, fontWeight: "700" as const, color: Colors.textSecondary, textTransform: "uppercase" },
  dateValue: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  saveBtn: { height: 46, borderRadius: 14, backgroundColor: Colors.secondary, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  statusRow: { flexDirection: "row", gap: 10 },
  statusBtn: { flex: 1, minWidth: 150, borderRadius: 16, paddingVertical: 12, alignItems: "center", backgroundColor: Colors.primaryLight },
  statusBtnResolve: { backgroundColor: Colors.successLight },
  statusBtnText: { color: Colors.primary, fontSize: 13, fontWeight: "700" as const },
  statusBtnResolveText: { color: Colors.success, fontSize: 13, fontWeight: "700" as const },
  workflowBox: { borderRadius: 16, padding: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  workflowTitle: { fontSize: 13, fontWeight: "700" as const, color: Colors.text },
  workflowText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  workerSectionTitle: { fontSize: 15, fontWeight: "700" as const, color: Colors.text },
  workerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  workerInfo: { flex: 1, gap: 2 },
  workerName: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  workerMeta: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  assignBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.primary },
  assignBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },
  assignedPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.successLight },
  assignedPillText: { color: Colors.success, fontSize: 12, fontWeight: "700" as const },
  buttonDisabled: { opacity: 0.45 },
  ruleText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  upvoteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: Colors.primary },
  upvoteBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  upvoteText: { color: Colors.primary, fontSize: 16, fontWeight: "600" as const },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text, marginBottom: 8 },
  timelineItem: { flexDirection: "row", gap: 12 },
  timelineLeft: { width: 20, alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, marginTop: 4, backgroundColor: Colors.border },
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineStatus: { fontSize: 15, fontWeight: "600" as const, color: Colors.text },
  timelineNote: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  timelineBy: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  timelineDate: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  reportCard: { marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: Colors.surface },
  reportTitle: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  reportBody: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, lineHeight: 20 },
  reportMeta: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
