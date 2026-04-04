import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRoute } from "@/lib/auth-routing";

export default function IntroScreen() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!user) {
        router.replace("/auth/welcome");
        return;
      }
      router.replace(getPostAuthRoute(user) as never);
    }, 900);

    return () => clearTimeout(timeout);
  }, [isLoading, user]);

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Feather name="shield" size={38} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Civic Samadhan</Text>
      <Text style={styles.subtitle}>Verifying reports and preparing your workspace</Text>
      <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
