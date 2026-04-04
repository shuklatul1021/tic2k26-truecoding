import React from "react";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Redirect, Stack, Tabs, useSegments } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Platform, StyleSheet, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

function WorkerTabs() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabIconActive,
        tabBarInactiveTintColor: Colors.tabIconInactive,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
          borderTopWidth: 1,
          borderTopColor: Colors.tabBarBorder,
          elevation: 0,
          height: isWeb ? 84 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#000" : "#fff" }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Worker Home",
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Worker Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen name="verify" options={{ href: null }} />
      <Tabs.Screen name="onboarding" options={{ href: null }} />
      <Tabs.Screen name="report/[id]" options={{ href: null }} />
    </Tabs>
  );
}

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
    return <Redirect href="/auth/login" />;
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

  if (!user.workerVerified || !user.onboardingCompleted) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="verify" />
        <Stack.Screen name="onboarding" />
      </Stack>
    );
  }

  return <WorkerTabs />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});
