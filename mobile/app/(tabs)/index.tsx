import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl,
  ActivityIndicator, Platform,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import {
  issuesApi,
  type IssueCategory,
  type IssueStatus,
} from "@/lib/api";
import { IssueCard } from "@/components/IssueCard";
import { useAuth } from "@/context/AuthContext";

const FILTERS = ["All", "Pending", "In Progress", "Resolved"];

const statusFilterMap: Record<string, IssueStatus | undefined> = {
  All: undefined,
  Pending: "pending",
  "In Progress": "in_progress",
  Resolved: "resolved",
};

const categoryFilterMap: Record<string, IssueCategory | undefined> = {
  All: undefined,
  Garbage: "garbage",
  Pothole: "pothole",
  "Water Leakage": "water_leakage",
  Other: "other",
};

export default function HomeScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const statusParam = statusFilterMap[statusFilter];
  const categoryParam = categoryFilterMap[categoryFilter];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["issues", statusParam, categoryParam],
    queryFn: () => issuesApi.getAll({ status: statusParam, category: categoryParam }),
  });

  const upvoteMutation = useMutation({
    mutationFn: (id: number) => issuesApi.upvote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issues"] }),
  });

  const topPadding = Platform.OS === "web" ? 67 : 0;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0] || "Citizen"}</Text>
          <Text style={styles.subtitle}>Report & track civic issues</Text>
        </View>
        <Pressable style={styles.notifBtn}>
          <Feather name="bell" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.filtersRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => {
            const active = item === statusFilter;
            return (
              <Pressable
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(item)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={data?.issues ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            onPress={() => router.push(`/issue/${item.id}`)}
            onUpvote={() => user ? upvoteMutation.mutate(item.id) : router.push("/auth/login")}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
          ) : (
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No issues found</Text>
              <Text style={styles.emptyText}>Be the first to report a civic issue</Text>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 + bottomPadding, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSection: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  greeting: { fontSize: 22, fontWeight: "700" as const, color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  filtersRow: { marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" as const },
  filterTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
});
