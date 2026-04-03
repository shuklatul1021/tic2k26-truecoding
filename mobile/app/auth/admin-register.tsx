import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { router, Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

export default function AdminRegisterScreen() {
  const insets = useSafeAreaInsets();
  const { registerAdmin } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!orgName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    try {
      setLoading(true);
      await registerAdmin(orgName.trim(), email.trim().toLowerCase(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/admin");
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Registration failed", err.message || "Could not create authority account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.secondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logo}>
            <Feather name="shield" size={34} color={Colors.secondary} />
          </View>
          <Text style={styles.appName}>Civic Samadhan</Text>
          <View style={styles.badge}>
            <Feather name="briefcase" size={12} color={Colors.secondary} />
            <Text style={styles.badgeText}>Authority Registration</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Register Organisation</Text>
          <Text style={styles.formSubtitle}>Create an admin account to manage and resolve civic issues</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Organisation / Authority Name</Text>
            <View style={styles.inputWrapper}>
              <Feather name="briefcase" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Municipal Corporation"
                placeholderTextColor={Colors.placeholder}
                value={orgName}
                onChangeText={setOrgName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Official Email</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="official@authority.gov"
                placeholderTextColor={Colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min 6 characters"
                placeholderTextColor={Colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="user-plus" size={18} color="#fff" />
                <Text style={styles.buttonText}>Create Authority Account</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already registered? </Text>
            <Link href="/auth/admin-login" asChild>
              <Pressable><Text style={styles.link}>Sign in</Text></Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Feather name="alert-circle" size={14} color={Colors.warning} />
          <Text style={styles.noteText}>
            Admin accounts have full access to manage, update status, and resolve all reported civic issues.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { color: Colors.secondary, fontSize: 15, fontWeight: "500" as const },
  header: { alignItems: "center", marginBottom: 28 },
  logo: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: Colors.secondaryLight, alignItems: "center",
    justifyContent: "center", marginBottom: 14,
    borderWidth: 2, borderColor: Colors.secondary + "33",
  },
  appName: { fontSize: 26, fontWeight: "800" as const, color: Colors.text, marginBottom: 8 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.secondaryLight, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: "600" as const, color: Colors.secondary },
  form: {
    backgroundColor: Colors.surface, borderRadius: 24, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16,
    elevation: 4, gap: 16,
    borderTopWidth: 3, borderTopColor: Colors.secondary,
  },
  formTitle: { fontSize: 22, fontWeight: "700" as const, color: Colors.text },
  formSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: -8 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" as const, color: Colors.text },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, backgroundColor: Colors.background, paddingHorizontal: 12, height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: Colors.text },
  eyeIcon: { padding: 4 },
  button: {
    backgroundColor: Colors.secondary, borderRadius: 12, height: 52,
    alignItems: "center", justifyContent: "center", marginTop: 4,
    flexDirection: "row", gap: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.secondary, fontSize: 14, fontWeight: "600" as const },
  noteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: Colors.warningLight, borderRadius: 14, padding: 16, marginTop: 20,
    borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  noteText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },
});
