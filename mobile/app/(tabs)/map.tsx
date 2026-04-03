import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { issuesApi, type MapIssue } from "@/lib/api";
import { Feather } from "@expo/vector-icons";

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

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
      <View style={styles.header}>
        <Text style={styles.title}>Issue Map</Text>
        <View style={styles.legend}>
          {[{ color: Colors.mapHigh, label: "High" }, { color: Colors.mapMedium, label: "Med" }, { color: Colors.mapLow, label: "Low" }].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton
        >
          {(issues ?? []).map((issue: MapIssue) => (
            <Marker
              key={issue.id}
              coordinate={{ latitude: issue.latitude, longitude: issue.longitude }}
              pinColor={markerColor(issue.priority)}
            >
              <Callout onPress={() => router.push(`/issue/${issue.id}`)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle} numberOfLines={2}>{issue.title}</Text>
                  <Text style={styles.calloutCat}>
                    {issue.category.replace(/_/g, " ")} | {issue.priority}
                  </Text>
                  <Text style={styles.calloutTap}>Tap to view</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      <View style={styles.stats}>
        <View style={styles.statChip}>
          <Feather name="map-pin" size={14} color={Colors.primary} />
          <Text style={styles.statText}>{issues?.length ?? 0} issues reported</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "700" as const, color: Colors.text },
  legend: { flexDirection: "row", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
  map: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 15 },
  callout: { width: 200, padding: 10 },
  calloutTitle: { fontSize: 14, fontWeight: "600" as const, color: Colors.text, marginBottom: 4 },
  calloutCat: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, textTransform: "capitalize" },
  calloutTap: { fontSize: 12, color: Colors.primary, fontWeight: "500" as const },
  stats: { position: "absolute", bottom: 100, left: 16, right: 16, alignItems: "center" },
  statChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  statText: { fontSize: 14, color: Colors.text, fontWeight: "500" as const },
});
