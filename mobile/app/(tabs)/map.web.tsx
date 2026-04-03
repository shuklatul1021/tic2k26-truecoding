import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { issuesApi } from "@/lib/api";
import { Feather } from "@expo/vector-icons";

export default function MapScreen() {
  const { data: issues, isLoading } = useQuery({
    queryKey: ["map-issues"],
    queryFn: () => issuesApi.getMap(),
  });

  const markerColor = (priority: string) => {
    switch (priority) {
      case "high": return Colors.mapHigh;
      case "medium": return Colors.mapMedium;
      default: return Colors.mapLow;
    }
  };

  return (
    <View style={styles.container}>
      <Feather name="map" size={56} color={Colors.textTertiary} />
      <Text style={styles.title}>Issue Map</Text>
      <Text style={styles.subtext}>Interactive map is available in the Expo Go mobile app</Text>
      <Text style={styles.subtext}>Scan the QR code in the preview to try it on your device</Text>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.issueList}>
          <Text style={styles.issueListTitle}>{issues?.length ?? 0} Active Issues</Text>
          {(issues ?? []).slice(0, 10).map((issue) => (
            <Pressable
              key={issue.id}
              style={styles.issueRow}
              onPress={() => router.push(`/issue/${issue.id}`)}
            >
              <View style={[styles.priorityDot, { backgroundColor: markerColor(issue.priority) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.issueName} numberOfLines={1}>{issue.title}</Text>
                <Text style={styles.issueMeta}>
                  {issue.category.replace(/_/g, " ")} | {issue.status.replace(/_/g, " ")}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
            </Pressable>
          ))}
          {(issues?.length ?? 0) === 0 && (
            <Text style={styles.empty}>No issues reported yet</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center",
    padding: 32, gap: 12,
    paddingTop: 67, paddingBottom: 34,
  },
  title: { fontSize: 22, fontWeight: "700" as const, color: Colors.text },
  subtext: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  issueList: { width: "100%", marginTop: 16, gap: 8, maxWidth: 600 },
  issueListTitle: { fontSize: 16, fontWeight: "600" as const, color: Colors.text, marginBottom: 8 },
  issueRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    backgroundColor: Colors.surface, borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  priorityDot: { width: 12, height: 12, borderRadius: 6 },
  issueName: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
  issueMeta: { fontSize: 12, color: Colors.textSecondary, textTransform: "capitalize", marginTop: 2 },
  empty: { color: Colors.textSecondary, fontSize: 14, textAlign: "center" },
});
