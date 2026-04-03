import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function WorkerLoginScreen() {
  const insets = useSafeAreaInsets();
  const { workerLogin, workerRegister } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleWorkerLogin() {
    if (!email.trim() || !aadhaarNumber.trim() || (mode === "register" && !name.trim())) {
      Alert.alert(
        "Missing fields",
        mode === "register"
          ? "Please enter your name, email, and Aadhaar number."
          : "Please enter your email and Aadhaar number.",
      );
      return;
    }

    try {
      setLoading(true);
      const worker =
        mode === "register"
          ? await workerRegister(name.trim(), email.trim().toLowerCase(), aadhaarNumber.trim())
          : await workerLogin(email.trim().toLowerCase(), aadhaarNumber.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace((worker.onboardingCompleted ? "/worker" : "/worker/onboarding") as never);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Worker login failed", error.message || "Could not continue as worker");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.warning} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logo}>
            <Feather name="tool" size={34} color={Colors.warning} />
          </View>
          <Text style={styles.appName}>Worker Access</Text>
          <Text style={styles.tagline}>Sign in if you already have an account or create a new worker account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.modeRow}>
            <Pressable style={[styles.modeChip, mode === "login" && styles.modeChipActive]} onPress={() => setMode("login")}>
              <Text style={[styles.modeChipText, mode === "login" && styles.modeChipTextActive]}>Login</Text>
            </Pressable>
            <Pressable style={[styles.modeChip, mode === "register" && styles.modeChipActive]} onPress={() => setMode("register")}>
              <Text style={[styles.modeChipText, mode === "register" && styles.modeChipTextActive]}>Create Account</Text>
            </Pressable>
          </View>

          <Text style={styles.formTitle}>{mode === "login" ? "Worker Login" : "Create Worker Account"}</Text>
          <Text style={styles.formSubtitle}>
            {mode === "login"
              ? "Existing workers can sign in using email and Aadhaar number"
              : "Create a worker account first, then continue to onboarding and assignments"}
          </Text>

          {mode === "register" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Worker name" placeholderTextColor={Colors.placeholder} />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="worker@example.com" placeholderTextColor={Colors.placeholder} autoCapitalize="none" keyboardType="email-address" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Aadhaar Number</Text>
            <TextInput style={styles.input} value={aadhaarNumber} onChangeText={setAadhaarNumber} placeholder="12-digit identity number" placeholderTextColor={Colors.placeholder} keyboardType="number-pad" />
          </View>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleWorkerLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{mode === "login" ? "Login as Worker" : "Create Worker Account"}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { color: Colors.warning, fontSize: 15, fontWeight: "500" as const },
  header: { alignItems: "center", marginBottom: 28 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  appName: { fontSize: 26, fontWeight: "800" as const, color: Colors.text },
  tagline: { marginTop: 8, fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderTopWidth: 3,
    borderTopColor: Colors.warning,
  },
  formTitle: { fontSize: 22, fontWeight: "700" as const, color: Colors.text },
  formSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: -8 },
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  modeChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  modeChipActive: { borderColor: Colors.warning, backgroundColor: Colors.warningLight },
  modeChipText: { color: Colors.textSecondary, fontWeight: "600" as const },
  modeChipTextActive: { color: Colors.warning },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" as const, color: Colors.text },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.warning,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
});
