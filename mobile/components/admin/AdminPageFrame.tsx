import React, { type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

interface AdminPageFrameProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AdminPageFrame({ eyebrow, title, subtitle, children }: AdminPageFrameProps) {
  const { user, logout } = useAuth();
  const topPadding = Platform.OS === "web" ? 52 : 34;

  async function handleLogout() {
    await logout();
    router.replace("/auth/welcome");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingTop: topPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />

        <View style={styles.heroTopRow}>
          <View style={styles.eyebrowBadge}>
            <Feather name="shield" size={14} color={Colors.primary} />
            <Text style={styles.eyebrowText}>{eyebrow}</Text>
          </View>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={17} color={Colors.textInverse} />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Feather name="user" size={14} color={Colors.primaryDark} />
            <Text style={styles.metaText}>{user?.name || "Admin"}</Text>
          </View>
          <View style={styles.metaPill}>
            <Feather name="layers" size={14} color={Colors.primaryDark} />
            <Text style={styles.metaText}>Control Center</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 20,
    padding: 15,
    backgroundColor: Colors.primaryDark,
    gap: 8,
  },
  heroGlowPrimary: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroGlowSecondary: {
    position: "absolute",
    bottom: -70,
    left: -50,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(13,184,134,0.18)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  eyebrowText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: "800" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  logoutText: {
    color: Colors.textInverse,
    fontSize: 11,
    fontWeight: "700" as const,
  },
  title: {
    color: Colors.textInverse,
    fontSize: 21,
    fontWeight: "800" as const,
    lineHeight: 26,
  },
  subtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "#DCE9FF",
  },
  metaText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: "700" as const,
  },
  body: {
    marginTop: 12,
    gap: 10,
  },
});
