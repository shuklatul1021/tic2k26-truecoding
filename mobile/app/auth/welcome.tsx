import React from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Platform,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.logoRing}>
          <Feather name="eye" size={38} color={Colors.primary} />
        </View>
        <Text style={styles.appName}>Civic Samadhan</Text>
        <Text style={styles.tagline}>Smart Civic Issue Reporting & Resolution</Text>
      </View>

      <Text style={styles.chooseLabel}>Who are you?</Text>

      <Pressable
        style={({ pressed }) => [styles.card, styles.citizenCard, pressed && styles.cardPressed]}
        onPress={() => router.push("/auth/login")}
      >
        <View style={[styles.cardIcon, { backgroundColor: Colors.primaryLight }]}>
          <Feather name="users" size={28} color={Colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: Colors.primary }]}>Citizen</Text>
          <Text style={styles.cardDesc}>
            Report civic issues, track their progress, and upvote problems in your community
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={Colors.primary} />
      </Pressable>

      <View style={styles.cardActions}>
        <Text style={styles.cardActionText}>New citizen? </Text>
        <Pressable onPress={() => router.push("/auth/register")}>
          <Text style={[styles.cardActionLink, { color: Colors.primary }]}>Create account</Text>
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, styles.adminCard, pressed && styles.cardPressed]}
        onPress={() => router.push("/auth/admin-login")}
      >
        <View style={[styles.cardIcon, { backgroundColor: Colors.secondaryLight }]}>
          <Feather name="shield" size={28} color={Colors.secondary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: Colors.secondary }]}>Authority / NGO</Text>
          <Text style={styles.cardDesc}>
            Government officials and NGOs who manage, assign and resolve civic issues
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={Colors.secondary} />
      </Pressable>

      <View style={styles.cardActions}>
        <Text style={styles.cardActionText}>New authority? </Text>
        <Pressable onPress={() => router.push("/auth/admin-register")}>
          <Text style={[styles.cardActionLink, { color: Colors.secondary }]}>Register organisation</Text>
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, styles.workerCard, pressed && styles.cardPressed]}
        onPress={() => router.push("/auth/worker-login" as never)}
      >
        <View style={[styles.cardIcon, { backgroundColor: Colors.warningLight }]}>
          <Feather name="tool" size={28} color={Colors.warning} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: Colors.warning }]}>Worker</Text>
          <Text style={styles.cardDesc}>
            Receive assigned issues, post daily progress, upload proof, and earn completion points
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={Colors.warning} />
      </Pressable>

      <View style={styles.footer}>
        <Feather name="shield" size={14} color={Colors.textTertiary} />
        <Text style={styles.footerText}>Your data is protected and never shared</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logoRing: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.primaryLight, alignItems: "center",
    justifyContent: "center", marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  appName: { fontSize: 32, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 20 },
  chooseLabel: {
    fontSize: 18, fontWeight: "700" as const, color: Colors.text, marginBottom: 16,
  },
  card: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    borderWidth: 1.5, borderColor: Colors.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  citizenCard: { borderColor: Colors.primaryLight },
  adminCard: { borderColor: Colors.secondaryLight },
  workerCard: { borderColor: Colors.warningLight },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  cardIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: "700" as const, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  cardActions: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    marginTop: 10, marginBottom: 4,
  },
  cardActionText: { fontSize: 13, color: Colors.textSecondary },
  cardActionLink: { fontSize: 13, fontWeight: "600" as const },
  divider: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textTertiary, fontSize: 13 },
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 32,
  },
  footerText: { fontSize: 12, color: Colors.textTertiary },
});
