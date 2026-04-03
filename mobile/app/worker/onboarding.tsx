import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { workersApi } from "@/lib/api";

export default function WorkerOnboardingScreen() {
  const { refreshUser } = useAuth();
  const [skills, setSkills] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [workLatitude, setWorkLatitude] = useState<number | undefined>(undefined);
  const [workLongitude, setWorkLongitude] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function detectLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Allow location access for worker assignment accuracy.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setWorkLatitude(position.coords.latitude);
      setWorkLongitude(position.coords.longitude);

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (geo) {
        setWorkAddress(
          `${geo.street || ""}, ${geo.city || ""}, ${geo.region || ""}`.replace(/^, |, $/g, ""),
        );
      }
    } catch {
      Alert.alert("Location failed", "Could not detect work location.");
    }
  }

  async function completeOnboarding() {
    const parsedSkills = skills
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsedSkills.length === 0) {
      Alert.alert("Missing skills", "Enter at least one worker skill.");
      return;
    }

    try {
      setLoading(true);
      await workersApi.onboard({
        skills: parsedSkills,
        workLatitude,
        workLongitude,
        workAddress: workAddress.trim() || undefined,
      });
      await refreshUser();
      router.replace("/worker" as never);
    } catch (error: any) {
      Alert.alert("Onboarding failed", error.message || "Could not save worker details");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.heading}>Worker Onboarding</Text>
      <Text style={styles.subheading}>Tell the system what work you can do and where you usually operate.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Skills</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: plumbing, road repair, sanitation"
          placeholderTextColor={Colors.placeholder}
          value={skills}
          onChangeText={setSkills}
        />

        <Text style={styles.label}>Work Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Primary work zone or depot"
          placeholderTextColor={Colors.placeholder}
          value={workAddress}
          onChangeText={setWorkAddress}
        />

        <Pressable style={styles.locationBtn} onPress={detectLocation}>
          <Feather name="map-pin" size={18} color={Colors.warning} />
          <Text style={styles.locationText}>
            {workLatitude && workLongitude
              ? `${workLatitude.toFixed(4)}, ${workLongitude.toFixed(4)}`
              : "Use my current work location"}
          </Text>
        </Pressable>

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={completeOnboarding} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Onboarding</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16 },
  heading: { fontSize: 28, fontWeight: "800" as const, color: Colors.text, marginTop: 18 },
  subheading: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 24, padding: 20, gap: 14 },
  label: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    height: 50,
    color: Colors.text,
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.warningLight,
  },
  locationText: { color: Colors.warning, fontWeight: "600" as const, flex: 1 },
  button: {
    marginTop: 8,
    backgroundColor: Colors.warning,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    height: 52,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
});
