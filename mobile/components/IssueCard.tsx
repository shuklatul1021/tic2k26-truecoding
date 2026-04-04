import React from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import type { Issue } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/utils";

interface Props {
  issue: Issue;
  onPress: () => void;
  onUpvote?: () => void;
}

const categoryConfig = {
  garbage: {
    icon: "trash-2",
    label: "Garbage",
    color: Colors.categoryGarbage,
    bg: Colors.categoryGarbageBg,
  },
  pothole: {
    icon: "alert-triangle",
    label: "Pothole",
    color: Colors.categoryPothole,
    bg: Colors.categoryPotholeBg,
  },
  water_leakage: {
    icon: "droplet",
    label: "Water Leakage",
    color: Colors.categoryWater,
    bg: Colors.categoryWaterBg,
  },
  other: {
    icon: "help-circle",
    label: "Other",
    color: Colors.categoryOther,
    bg: Colors.categoryOtherBg,
  },
} as const;

export function IssueCard({ issue, onPress, onUpvote }: Props) {
  const priorityColor = {
    high: Colors.priorityHigh,
    medium: Colors.priorityMedium,
    low: Colors.priorityLow,
  }[issue.priority];

  const priorityBg = {
    high: Colors.priorityHighBg,
    medium: Colors.priorityMediumBg,
    low: Colors.priorityLowBg,
  }[issue.priority];

  const statusColor = {
    pending: Colors.statusPending,
    in_progress: Colors.statusInProgress,
    resolved: Colors.statusResolved,
    closed: Colors.statusResolved,
  }[issue.status];

  const statusBg = {
    pending: Colors.statusPendingBg,
    in_progress: Colors.statusInProgressBg,
    resolved: Colors.statusResolvedBg,
    closed: Colors.statusResolvedBg,
  }[issue.status];

  const statusLabel = {
    pending: "Pending",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  }[issue.status];

  const category = categoryConfig[issue.category];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.mediaWrap}>
        <Image source={{ uri: issue.imageUrl }} style={styles.image} resizeMode="cover" />
        <View style={styles.imageOverlay} />
        <View style={styles.topBadges}>
          <View style={[styles.pill, { backgroundColor: priorityBg }]}>
            <Text style={[styles.pillText, { color: priorityColor }]}>
              {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: statusBg }]}>
            <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.headlineRow}>
          <View style={styles.categoryTag}>
            <View style={[styles.categoryIconWrap, { backgroundColor: category.bg }]}>
              <Feather name={category.icon as any} size={13} color={category.color} />
            </View>
            <Text style={styles.categoryText}>{category.label}</Text>
          </View>
          <Text style={styles.time}>{formatDistanceToNow(issue.createdAt)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{issue.title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {issue.description}
        </Text>

        {issue.address ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={Colors.textTertiary} />
            <Text style={styles.locationText} numberOfLines={1}>{issue.address}</Text>
          </View>
        ) : null}

        {typeof issue.distanceKm === "number" ? (
          <View style={styles.distanceRow}>
            <Feather name="navigation" size={13} color={Colors.primary} />
            <Text style={styles.distanceText}>{issue.distanceKm.toFixed(1)} km away</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.metaCluster}>
            <View style={styles.metaPill}>
              <Feather name="arrow-up-right" size={13} color={Colors.textSecondary} />
              <Text style={styles.metaPillText}>{issue.upvotes} upvotes</Text>
            </View>
          </View>
          {onUpvote ? (
            <Pressable
              style={[styles.upvoteBtn, issue.hasUpvoted && styles.upvoteBtnActive]}
              onPress={(event) => {
                event.stopPropagation();
                onUpvote();
              }}
            >
              <Ionicons
                name={issue.hasUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"}
                size={18}
                color={issue.hasUpvoted ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.upvoteText, issue.hasUpvoted && styles.upvoteTextActive]}>
                Support
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.97,
    transform: [{ scale: 0.992 }],
  },
  mediaWrap: {
    position: "relative",
    height: 176,
    backgroundColor: Colors.borderLight,
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.borderLight,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 25, 47, 0.08)",
  },
  topBadges: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  categoryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "700" as const,
  },
  time: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.text,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textTertiary,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "700" as const,
  },
  footer: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.background,
  },
  metaPillText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "700" as const,
  },
  upvoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  upvoteBtnActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: "#B8D0F2",
  },
  upvoteText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
  },
  upvoteTextActive: {
    color: Colors.primary,
  },
});
