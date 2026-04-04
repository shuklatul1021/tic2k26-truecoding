import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { workersApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/utils";

export default function WorkerDashboardScreen() {
  const { user, logout } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["worker-assignments"],
    queryFn: workersApi.getAssignments,
  });

  async function handleLogout() {
    await logout();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Worker Dashboard</Text>
          <Text style={styles.subheading}>Daily assignments and progress reporting</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={18} color={Colors.warning} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{user?.pointsBalance ?? 0}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>Rs {Number(user?.walletBalance ?? 0).toFixed(2)}</Text>
          <Text style={styles.statLabel}>Wallet</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Assigned Issues</Text>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.warning} /></View>
      ) : (
        (data ?? []).map((issue) => (
          <View key={issue.id} style={styles.issueCard}>
            <Text style={styles.issueTitle}>{issue.title}</Text>
            <Text style={styles.issueMeta}>{issue.address || "No address"} </Text>
            <Text style={styles.issueMeta}>Status: {issue.status.replace(/_/g, " ")}</Text>
            <Text style={styles.issueMeta}>Due: {formatDateTime(issue.dueAt)}</Text>
            <Text style={styles.issueMeta}>
              Reward: {issue.workerPoints ?? 0} pts + bonus {issue.workerBonusPoints ?? 0} pts
            </Text>
            <View style={styles.actions}>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push(`/issue/${issue.id}`)}>
                <Text style={styles.secondaryText}>Open Issue</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => router.push(`/worker/report/${issue.id}` as never)}>
                <Text style={styles.primaryText}>Update Today</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {(data?.length ?? 0) === 0 && !isLoading && (
        <View style={styles.empty}>
          <Feather name="inbox" size={42} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No assignments yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 18, gap: 16, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 },
  heading: { fontSize: 28, fontWeight: "800" as const, color: Colors.text },
  subheading: { marginTop: 6, fontSize: 14, color: Colors.textSecondary },
  logoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.warningLight, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 18, padding: 18, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800" as const, color: Colors.warning },
  statLabel: { marginTop: 4, color: Colors.textSecondary },
  sectionTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  loading: { padding: 24, alignItems: "center" },
  issueCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 18, gap: 6 },
  issueTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  issueMeta: { fontSize: 13, color: Colors.textSecondary },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  primaryBtn: { flex: 1, backgroundColor: Colors.warning, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" as const },
  secondaryBtn: { flex: 1, backgroundColor: Colors.warningLight, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: Colors.warning, fontWeight: "700" as const },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { color: Colors.textSecondary },
});
