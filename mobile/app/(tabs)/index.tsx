import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import {
  issuesApi,
  type Issue,
  type IssueCategory,
  type IssueStatus,
} from "@/lib/api";
import { IssueCard } from "@/components/IssueCard";
import { useAuth } from "@/context/AuthContext";

const STATUS_FILTERS = ["All", "Pending", "In Progress", "Resolved"] as const;
const CATEGORY_FILTERS = ["All", "Garbage", "Pothole", "Water Leakage", "Other"] as const;
const NEARBY_RADIUS_KM = 20;

const statusFilterMap: Record<(typeof STATUS_FILTERS)[number], IssueStatus | undefined> = {
  All: undefined,
  Pending: "pending",
  "In Progress": "in_progress",
  Resolved: "resolved",
};

const categoryFilterMap: Record<(typeof CATEGORY_FILTERS)[number], IssueCategory | undefined> = {
  All: undefined,
  Garbage: "garbage",
  Pothole: "pothole",
  "Water Leakage": "water_leakage",
  Other: "other",
};

type StatCard = {
  key: string;
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Feather>["name"];
  tone: "blue" | "green" | "orange" | "red";
};

type DashboardLocation = {
  lat: number;
  lng: number;
  label: string;
};

const toneStyles = {
  blue: { bg: "#EAF4FF", iconBg: "#D6E8FF", color: Colors.primary },
  green: { bg: "#E9FAF4", iconBg: "#D2F3E7", color: Colors.secondary },
  orange: { bg: "#FFF3E8", iconBg: "#FFE6CB", color: Colors.warning },
  red: { bg: "#FFF0F0", iconBg: "#FFDCDC", color: Colors.danger },
};

function buildAreaLabel(address?: Location.LocationGeocodedAddress | null) {
  if (!address) {
    return "Current area";
  }

  const parts = [
    address.district,
    address.city,
    address.region,
  ].filter(Boolean);

  return parts.join(", ") || "Current area";
}

export default function HomeScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const [userLocation, setUserLocation] = useState<DashboardLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const statusParam = statusFilter === "Resolved" ? undefined : statusFilterMap[statusFilter];
  const categoryParam = categoryFilterMap[categoryFilter];

  async function loadNearbyLocation() {
    setLoadingLocation(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setUserLocation(null);
        setLocationError("Allow location access to see nearby reports around you.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [address] = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      setUserLocation({
        lat: current.coords.latitude,
        lng: current.coords.longitude,
        label: buildAreaLabel(address),
      });
    } catch {
      setUserLocation(null);
      setLocationError("Could not detect your location. Try again to load nearby reports.");
    } finally {
      setLoadingLocation(false);
    }
  }

  useEffect(() => {
    void loadNearbyLocation();
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["issues", statusParam, categoryParam, userLocation?.lat, userLocation?.lng],
    queryFn: () =>
      issuesApi.getAll({
        status: statusParam,
        category: categoryParam,
        latitude: userLocation!.lat,
        longitude: userLocation!.lng,
        radiusKm: NEARBY_RADIUS_KM,
      }),
    enabled: !!userLocation,
  });

  const upvoteMutation = useMutation({
    mutationFn: (id: number) => issuesApi.upvote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issues"] }),
  });

  const topPadding = Platform.OS === "web" ? 67 : 0;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;
  const wideLayout = width >= 820;

  const issues = (data?.issues ?? []).filter((issue) => statusFilter === "Resolved" ? ["resolved", "closed"].includes(issue.status) : true);

  const stats = useMemo<StatCard[]>(() => {
    const pending = issues.filter((issue) => issue.status === "pending").length;
    const inProgress = issues.filter((issue) => issue.status === "in_progress").length;
    const resolved = issues.filter((issue) => ["resolved", "closed"].includes(issue.status)).length;
    const highPriority = issues.filter((issue) => issue.priority === "high").length;

    return [
      { key: "total", label: "Nearby Issues", value: issues.length, icon: "layers", tone: "blue" },
      { key: "pending", label: "Need Attention", value: pending + inProgress, icon: "alert-circle", tone: "orange" },
      { key: "resolved", label: "Resolved", value: resolved, icon: "check-circle", tone: "green" },
      { key: "high", label: "High Priority", value: highPriority, icon: "zap", tone: "red" },
    ];
  }, [issues]);

  const latestIssue = issues[0];

  const handleRefresh = async () => {
    await loadNearbyLocation();
    if (userLocation) {
      await refetch();
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.heroShell}>
        <View style={styles.heroGlow} />
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroEyebrow}>Citizen Dashboard</Text>
              <Text style={styles.heroTitle}>Hello, {user?.name?.split(" ")[0] || "Citizen"}</Text>
              <Text style={styles.heroSubtitle}>
                Reports shown here are based on your current location so you only see nearby civic issues.
              </Text>
              <View style={styles.locationPill}>
                <Feather name="map-pin" size={14} color={Colors.primaryDark} />
                <Text style={styles.locationPillText}>
                  {loadingLocation ? "Finding your location..." : userLocation?.label || "Location unavailable"}
                </Text>
              </View>
            </View>
            <Pressable style={styles.heroAction} onPress={() => router.push("/report")}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.heroActionText}>Report Issue</Text>
            </Pressable>
          </View>

          <View style={[styles.heroStatsRow, wideLayout && styles.heroStatsRowWide]}>
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

          {latestIssue ? (
            <View style={styles.heroFooter}>
              <View style={styles.heroFooterLabel}>
                <Feather name="navigation" size={14} color={Colors.primaryDark} />
                <Text style={styles.heroFooterLabelText}>Closest issue in {NEARBY_RADIUS_KM} km</Text>
              </View>
              <Text style={styles.heroFooterTitle} numberOfLines={1}>{latestIssue.title}</Text>
              <Text style={styles.heroFooterMeta}>
                {typeof latestIssue.distanceKm === "number" ? `${latestIssue.distanceKm.toFixed(1)} km away` : "Nearby"}
              </Text>
              <Pressable style={styles.heroFooterLink} onPress={() => router.push(`/issue/${latestIssue.id}`)}>
                <Text style={styles.heroFooterLinkText}>Open</Text>
                <Feather name="arrow-right" size={14} color={Colors.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.filtersSection}>
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionTitle}>Nearby Reports</Text>
            <Text style={styles.sectionSubtitle}>Filtered within {NEARBY_RADIUS_KM} km of your visible location</Text>
          </View>
          <Pressable style={styles.refreshPill} onPress={() => void handleRefresh()}>
            <Feather name="refresh-cw" size={14} color={Colors.primary} />
            <Text style={styles.refreshPillText}>Refresh</Text>
          </Pressable>
        </View>

        <Text style={styles.filterLabel}>Status</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filtersList}
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

        <Text style={styles.filterLabel}>Category</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => {
            const active = item === categoryFilter;
            return (
              <Pressable
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategoryFilter(item)}
              >
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.feedHeading}>
        <Text style={styles.feedTitle}>Reports Near You</Text>
        <Text style={styles.feedCount}>{issues.length} visible</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Issue }) => (
    <IssueCard
      issue={item}
      onPress={() => router.push(`/issue/${item.id}`)}
      onUpvote={user?.id === item.userId ? undefined : () => user ? upvoteMutation.mutate(item.id) : router.push("/auth/login")}
    />
  );

  const showLocationState = !loadingLocation && !userLocation;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <FlatList
        data={showLocationState ? [] : issues}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loadingLocation || (isLoading && userLocation) ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : showLocationState ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Feather name="map-pin" size={34} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Location needed</Text>
              <Text style={styles.emptyText}>
                {locationError || "Enable location access to load nearby reports instead of all reports."}
              </Text>
              <Pressable style={styles.emptyAction} onPress={() => void loadNearbyLocation()}>
                <Feather name="crosshair" size={16} color="#fff" />
                <Text style={styles.emptyActionText}>Use My Location</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Feather name="inbox" size={34} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No nearby reports found</Text>
              <Text style={styles.emptyText}>
                Try refreshing your location or create a new report for your area.
              </Text>
              <Pressable style={styles.emptyAction} onPress={() => router.push("/report")}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.emptyActionText}>Create Report</Text>
              </Pressable>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching || loadingLocation}
            onRefresh={() => void handleRefresh()}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 110 + bottomPadding, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerContent: { paddingBottom: 12 },
  heroShell: {
    marginHorizontal: 16,
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
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  heroTextWrap: { flex: 1, minWidth: 220 },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.text,
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    maxWidth: 520,
  },
  locationPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFFC9",
    borderWidth: 1,
    borderColor: "#D6E5F6",
  },
  locationPillText: {
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: "700" as const,
  },
  heroAction: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0B4C9C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  heroActionText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  heroStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStatsRowWide: { gap: 12 },
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
  heroFooter: {
    backgroundColor: "#FFFFFFB8",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DFEAF7",
    gap: 6,
  },
  heroFooterLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroFooterLabelText: { fontSize: 12, color: Colors.primaryDark, fontWeight: "700" as const },
  heroFooterTitle: { fontSize: 15, color: Colors.text, fontWeight: "700" as const },
  heroFooterMeta: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" as const },
  heroFooterLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  heroFooterLinkText: { fontSize: 13, color: Colors.primary, fontWeight: "700" as const },
  filtersSection: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" as const, color: Colors.text },
  sectionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshPillText: { color: Colors.primary, fontSize: 13, fontWeight: "700" as const },
  filterLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filtersList: { gap: 8, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "600" as const },
  filterTextActive: { color: "#fff" },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FBFCFE",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: "#E7F1FF",
    borderColor: "#BDD5F7",
  },
  categoryText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" as const },
  categoryTextActive: { color: Colors.primaryDark },
  feedHeading: {
    marginTop: 18,
    marginBottom: 6,
    marginHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedTitle: { fontSize: 18, fontWeight: "800" as const, color: Colors.text },
  feedCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" as const },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800" as const, color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  emptyAction: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyActionText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
});
