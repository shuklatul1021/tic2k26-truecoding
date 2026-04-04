import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const slides = [
  {
    icon: "globe",
    title: "Know The Platform",
    description:
      "Civic Samadhan helps citizens report issues, lets admins coordinate action, and keeps workers connected to real assignments.",
    accent: "#E6F5EA",
  },
  {
    icon: "map-pin",
    title: "Track What Matters",
    description:
      "Reports, updates, verification, and issue progress stay in one place so the community can see what is happening clearly.",
    accent: "#E6F1FF",
  },
  {
    icon: "shield",
    title: "Move With Roles",
    description:
      "Citizens create accounts, admins sign in with pre-provisioned access, and workers receive credentials directly from admins.",
    accent: "#FFF0E1",
  },
];

export default function WelcomeScreen() {
  const [step, setStep] = useState(0);
  const isLastStep = step === slides.length - 1;
  const slide = slides[step];
  const progress = useMemo(() => slides.map((_, index) => index <= step), [step]);

  function goNext() {
    if (isLastStep) {
      router.replace("/auth/login" as never);
      return;
    }

    setStep((current) => current + 1);
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Pressable style={styles.skipButton} onPress={() => router.replace("/auth/login" as never)}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <View style={[styles.heroCard, { backgroundColor: slide.accent }]}>
          <View style={styles.iconShell}>
            <Feather name={slide.icon as never} size={34} color={Colors.primary} />
          </View>
          <Text style={styles.eyebrow}>Welcome To Civic Samadhan</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.progressRow}>
            {progress.map((active, index) => (
              <View key={slides[index].title} style={[styles.progressDot, active && styles.progressDotActive]} />
            ))}
          </View>

          <Pressable style={styles.primaryButton} onPress={goNext}>
            <Text style={styles.primaryButtonText}>{isLastStep ? "Get Started" : "Next"}</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F9FC" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32, justifyContent: "space-between" },
  skipButton: { alignSelf: "flex-end", paddingHorizontal: 10, paddingVertical: 6 },
  skipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" as const },
  heroCard: {
    flex: 1,
    marginTop: 18,
    marginBottom: 28,
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 34,
    justifyContent: "center",
  },
  iconShell: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#FFFFFFCC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Colors.textSecondary,
    marginBottom: 12,
    fontWeight: "700" as const,
  },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "800" as const, color: Colors.text, marginBottom: 14 },
  description: { fontSize: 16, lineHeight: 25, color: Colors.textSecondary },
  footer: { gap: 18 },
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  progressDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: Colors.border },
  progressDotActive: { width: 28, backgroundColor: Colors.primary },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
});
