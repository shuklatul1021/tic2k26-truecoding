import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { issuesApi } from "@/lib/api";
import { IssueCard } from "@/components/IssueCard";

type ProfileStat = {
  key: string;
  label: string;
  value: number | string;
  icon: React.ComponentProps<typeof Feather>["name"];
  tone: "blue" | "green" | "orange" | "gold";
};

const toneStyles = {
  blue: { bg: "#EAF4FF", iconBg: "#D6E8FF", color: Colors.primary },
  green: { bg: "#E9FAF4", iconBg: "#D2F3E7", color: Colors.success },
  orange: { bg: "#FFF3E8", iconBg: "#FFE6CB", color: Colors.warning },
  gold: { bg: "#FFF9E8", iconBg: "#FFE9B3", color: Colors.accent },
};

export default function ProfileScreen() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const topPadding = Platform.OS === "web" ? 67 : 0;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;
  const wideLayout = width >= 840;

  const { data, isLoading } = useQuery({
    queryKey: ["user-issues", user?.id],
    queryFn: () => (user ? issuesApi.getUserIssues(user.id) : Promise.reject()),
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPadding }]}>
        <View style={styles.signedOutCard}>
          <View style={styles.signedOutIconWrap}>
            <Feather name="user" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.signedOutTitle}>Not signed in</Text>
          <Text style={styles.signedOutText}>
            Sign in to see your rewards, activity, and the issues you have reported.
          </Text>
          <Pressable style={styles.signInBtn} onPress={() => router.push("/auth/login")}>
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const issues = data?.issues ?? [];
  const resolvedCount = issues.filter((issue) => issue.status === "resolved").length;
  const pendingCount = issues.filter((issue) => issue.status === "pending").length;
  const inProgressCount = issues.filter((issue) => issue.status === "in_progress").length;

  const stats = useMemo<ProfileStat[]>(() => [
    { key: "reported", label: "Reported", value: data?.total ?? 0, icon: "flag", tone: "blue" },
    { key: "resolved", label: "Resolved", value: resolvedCount, icon: "check-circle", tone: "green" },
    { key: "active", label: "Active", value: pendingCount + inProgressCount, icon: "clock", tone: "orange" },
    { key: "points", label: "Points", value: user.pointsBalance ?? 0, icon: "award", tone: "gold" },
  ], [data?.total, inProgressCount, pendingCount, resolvedCount, user.pointsBalance]);

  const recentIssues = issues.slice(0, 4);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: 110 + bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroShell}>
        <View style={styles.heroGlow} />
        <View style={styles.heroCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.identityText}>
                <Text style={styles.heroEyebrow}>{user.role === "admin" ? "Admin Profile" : "Citizen Profile"}</Text>
                <Text style={styles.name}>{user.name}</Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.roleBadge}>
              <Feather name={user.role === "admin" ? "shield" : "user"} size={14} color={Colors.primaryDark} />
              <Text style={styles.roleText}>{user.role === "admin" ? "Admin" : "Citizen"}</Text>
            </View>
          </View>

          <Text style={styles.heroSummary}>
            Keep track of your civic contributions, reward balance, and recent reports from one place.
          </Text>

          <View style={[styles.statsGrid, wideLayout && styles.statsGridWide]}>
            {stats.map((stat) => {
              const tone = toneStyles[stat.tone];
              return (
                <View key={stat.key} style={[styles.statCard, { backgroundColor: tone.bg }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: tone.iconBg }]}>
                    <Feather name={stat.icon} size={16} color={tone.color} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View>
            <Text style={styles.walletLabel}>Reward Wallet</Text>
            <Text style={styles.walletValue}>Rs {Number(user.walletBalance ?? 0).toFixed(2)}</Text>
          </View>
          <View style={styles.walletChip}>
            <Feather name="credit-card" size={16} color={Colors.warning} />
            <Text style={styles.walletChipText}>{user.pointsBalance ?? 0} pts</Text>
          </View>
        </View>
        <Text style={styles.walletNote}>
          Rewards are credited after verification and successful resolution of the issues you report.
        </Text>
      </View>

      <View style={styles.actionsRow}>
        {user.role === "admin" ? (
          <Pressable style={styles.actionCard} onPress={() => router.push("/admin")}>
            <View style={styles.actionIconWrap}>
              <Feather name="shield" size={18} color={Colors.primary} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Admin Dashboard</Text>
              <Text style={styles.actionSubtitle}>Manage reports, assignments, and city activity</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.primary} />
          </Pressable>
        ) : (
          <Pressable style={styles.actionCard} onPress={() => router.push("/report")}>
            <View style={styles.actionIconWrap}>
              <Feather name="plus-circle" size={18} color={Colors.primary} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Report New Issue</Text>
              <Text style={styles.actionSubtitle}>Capture a problem and send it for verification</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.primary} />
          </Pressable>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            <Text style={styles.sectionSubtitle}>
              {data?.total ?? 0} total reports linked to your account
            </Text>
          </View>
          {data?.total ? (
            <View style={styles.sectionCountChip}>
              <Text style={styles.sectionCountText}>{data.total}</Text>
            </View>
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.sectionLoading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : recentIssues.length > 0 ? (
          recentIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onPress={() => router.push(`/issue/${issue.id}`)}
            />
          ))
        ) : (
          <View style={styles.emptySection}>
            <View style={styles.emptySectionIconWrap}>
              <Feather name="inbox" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.emptySectionTitle}>No reports yet</Text>
            <Text style={styles.emptySectionText}>
              Start reporting nearby issues and they will appear here.
            </Text>
            <Pressable style={styles.emptySectionAction} onPress={() => router.push("/report")}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptySectionActionText}>Create Report</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Pressable
        style={styles.logoutBtn}
        onPress={() => Alert.alert("Logout", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", style: "destructive", onPress: logout },
        ])}
      >
        <Feather name="log-out" size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 16 },
  center: { alignItems: "center", justifyContent: "center", flex: 1, paddingHorizontal: 24 },
  signedOutCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  signedOutIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  signedOutTitle: { fontSize: 22, fontWeight: "800" as const, color: Colors.text },
  signedOutText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, textAlign: "center" },
  signInBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 26,
    paddingVertical: 14,
    marginTop: 8,
  },
  signInText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
  heroShell: {
    marginTop: 12,
    marginBottom: 18,
    borderRadius: 28,
    overflow: "hidden",
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#DCEBFF",
  },
  heroCard: {
    backgroundColor: "#F3F8FF",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D9E8FA",
    gap: 18,
  },
  profileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
    minWidth: 220,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 30, fontWeight: "800" as const, color: Colors.primary },
  identityText: { flex: 1 },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  name: { fontSize: 28, fontWeight: "800" as const, color: Colors.text, lineHeight: 34 },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFFCC",
    borderWidth: 1,
    borderColor: "#D6E5F6",
  },
  roleText: { fontSize: 13, fontWeight: "700" as const, color: Colors.primaryDark },
  heroSummary: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statsGridWide: { gap: 12 },
  statCard: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 96,
    borderRadius: 20,
    padding: 14,
    justifyContent: "space-between",
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 24, fontWeight: "800" as const, color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" as const },
  walletCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  walletLabel: { fontSize: 13, fontWeight: "700" as const, color: Colors.warning, textTransform: "uppercase", letterSpacing: 0.5 },
  walletValue: { fontSize: 30, fontWeight: "800" as const, color: Colors.text, marginTop: 6 },
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.warningLight,
  },
  walletChipText: { fontSize: 13, fontWeight: "700" as const, color: Colors.warning },
  walletNote: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 10 },
  actionsRow: { marginBottom: 16 },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: "800" as const, color: Colors.text },
  actionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" as const, color: Colors.text },
  sectionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  sectionCountChip: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  sectionCountText: { fontSize: 13, fontWeight: "800" as const, color: Colors.primary },
  sectionLoading: { paddingVertical: 28, alignItems: "center", justifyContent: "center" },
  emptySection: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptySectionIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emptySectionTitle: { fontSize: 18, fontWeight: "800" as const, color: Colors.text },
  emptySectionText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  emptySectionAction: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptySectionActionText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.dangerLight,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F3C4C4",
  },
  logoutText: { fontSize: 16, fontWeight: "700" as const, color: Colors.danger },
});