import React from "react";
import { View, Text, Image, StyleSheet, Pressable, Platform } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import type { Issue } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/utils";

interface Props {
  issue: Issue;
  onPress: () => void;
  onUpvote?: () => void;
}

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
  }[issue.status];

  const statusBg = {
    pending: Colors.statusPendingBg,
    in_progress: Colors.statusInProgressBg,
    resolved: Colors.statusResolvedBg,
  }[issue.status];

  const categoryIcon = {
    garbage: "trash-2",
    pothole: "alert-triangle",
    water_leakage: "droplet",
    other: "help-circle",
  }[issue.category] as any;

  const categoryLabel = {
    garbage: "Garbage",
    pothole: "Pothole",
    water_leakage: "Water Leakage",
    other: "Other",
  }[issue.category];

  const statusLabel = {
    pending: "Pending",
    in_progress: "In Progress",
    resolved: "Resolved",
  }[issue.status];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
      onPress={onPress}
    >
      <Image source={{ uri: issue.imageUrl }} style={styles.image} resizeMode="cover" />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: priorityBg }]}>
              <Text style={[styles.badgeText, { color: priorityColor }]}>
                {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusBg }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.time}>{formatDistanceToNow(issue.createdAt)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{issue.title}</Text>

        <View style={styles.footer}>
          <View style={styles.category}>
            <Feather name={categoryIcon} size={13} color={Colors.textSecondary} />
            <Text style={styles.categoryText}>{categoryLabel}</Text>
          </View>
          <Pressable
            style={styles.upvote}
            onPress={(event) => {
              event.stopPropagation();
              onUpvote?.();
            }}
          >
            <Ionicons
              name={issue.hasUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"}
              size={18}
              color={issue.hasUpvoted ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.upvoteText, issue.hasUpvoted && { color: Colors.primary }]}>
              {issue.upvotes}
            </Text>
          </Pressable>
        </View>

        {issue.address && (
          <View style={styles.location}>
            <Feather name="map-pin" size={12} color={Colors.textTertiary} />
            <Text style={styles.locationText} numberOfLines={1}>{issue.address}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 160,
    backgroundColor: Colors.borderLight,
  },
  content: {
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  time: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  title: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  upvote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderRadius: 20,
  },
  upvoteText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textTertiary,
    flex: 1,
  },
});
