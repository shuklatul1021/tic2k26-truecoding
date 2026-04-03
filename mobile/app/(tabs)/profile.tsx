import React from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform, FlatList,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { issuesApi } from "@/lib/api";
import { IssueCard } from "@/components/IssueCard";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : 0;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const { data } = useQuery({
    queryKey: ["user-issues", user?.id],
    queryFn: () => (user ? issuesApi.getUserIssues(user.id) : Promise.reject()),
    enabled: !!user,
  });

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPadding }]}>
        <Feather name="user" size={64} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>Not signed in</Text>
        <Text style={styles.emptyText}>Sign in to see your profile</Text>
        <Pressable style={styles.signInBtn} onPress={() => router.push("/auth/login")}>
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const stats = [
    { label: "Reported", value: data?.total ?? 0, icon: "flag", color: Colors.primary },
    { label: "Resolved", value: data?.issues?.filter((i) => i.status === "resolved").length ?? 0, icon: "check-circle", color: Colors.success },
    { label: "Pending", value: data?.issues?.filter((i) => i.status === "pending").length ?? 0, icon: "clock", color: Colors.warning },
    { label: "Points", value: user.pointsBalance ?? 0, icon: "award", color: Colors.accent },
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: 100 + bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={[styles.roleBadge, user.role === "admin" && { backgroundColor: Colors.primaryLight }]}>
          <Text style={[styles.roleText, user.role === "admin" && { color: Colors.primary }]}>
            {user.role === "admin" ? "Admin" : "Citizen"}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Feather name={s.icon as any} size={20} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Reward Wallet</Text>
        <Text style={styles.walletValue}>Rs {Number(user.walletBalance ?? 0).toFixed(2)}</Text>
        <Text style={styles.walletNote}>Points are credited after issue verification and successful resolution.</Text>
      </View>

      {user.role === "admin" && (
        <Pressable style={styles.adminBtn} onPress={() => router.push("/admin")}>
          <Feather name="shield" size={18} color={Colors.primary} />
          <Text style={styles.adminBtnText}>Admin Dashboard</Text>
          <Feather name="chevron-right" size={18} color={Colors.primary} />
        </Pressable>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Reports ({data?.total ?? 0})</Text>
        {(data?.issues ?? []).slice(0, 5).map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onPress={() => router.push(`/issue/${issue.id}`)}
          />
        ))}
        {(data?.issues?.length ?? 0) === 0 && (
          <View style={styles.emptySection}>
            <Feather name="inbox" size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No issues reported yet</Text>
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
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  profileCard: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    alignItems: "center", marginTop: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "700" as const, color: Colors.primary },
  name: { fontSize: 20, fontWeight: "700" as const, color: Colors.text },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  roleBadge: {
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: Colors.background, borderRadius: 20,
  },
  roleText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    alignItems: "center", gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: "700" as const },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
  adminBtn: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.primaryLight,
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  walletCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  walletLabel: { fontSize: 13, fontWeight: "600" as const, color: Colors.warning },
  walletValue: { fontSize: 28, fontWeight: "800" as const, color: Colors.text, marginTop: 6 },
  walletNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  adminBtnText: { flex: 1, fontSize: 16, fontWeight: "600" as const, color: Colors.primary },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700" as const, color: Colors.text, marginBottom: 12, paddingHorizontal: 0 },
  emptySection: { alignItems: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  signInBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 32,
    paddingVertical: 14, marginTop: 8,
  },
  signInText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    padding: 16, borderRadius: 16, backgroundColor: Colors.dangerLight, marginBottom: 20,
  },
  logoutText: { fontSize: 16, fontWeight: "600" as const, color: Colors.danger },
});
