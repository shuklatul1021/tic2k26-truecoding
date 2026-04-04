import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Stack, useSegments } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function WorkerLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const activeChildRoute = String(segments[1] ?? "index");

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.warning} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/welcome" />;
  }

  if (user.role !== "worker") {
    return <Redirect href={user.role === "admin" ? "/admin" : "/(tabs)"} />;
  }

  if (!user.workerVerified && activeChildRoute !== "verify") {
    return <Redirect href={"/worker/verify" as never} />;
  }

  if (user.workerVerified && !user.onboardingCompleted && activeChildRoute !== "onboarding") {
    return <Redirect href="/worker/onboarding" />;
  }

  if (user.workerVerified && user.onboardingCompleted && (activeChildRoute === "verify" || activeChildRoute === "onboarding")) {
    return <Redirect href="/worker" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="report/[id]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});
