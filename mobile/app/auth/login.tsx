import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";
import { getPostAuthRoute } from "@/lib/auth-routing";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    try {
      setLoading(true);
      const loggedUser = await login(email.trim().toLowerCase(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(getPostAuthRoute(loggedUser) as never);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Login failed", err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.replace("/auth/welcome" as never)}>
          <Feather name="arrow-left" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logo}>
            <Feather name="shield" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Civic Samadhan</Text>
          <View style={styles.badge}>
            <Feather name="log-in" size={12} color={Colors.primary} />
            <Text style={styles.badgeText}>One Login For All Roles</Text>
          </View>
          <Text style={styles.tagline}>
            Citizens, admins, and workers all sign in here. Your role decides where you are sent next.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Sign in</Text>
          <Text style={styles.formSubtitle}>
            Users can create accounts. Admins sign in with backend credentials. Workers sign in with credentials created by admins.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
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
                placeholder="Enter password"
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
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Need a citizen account? </Text>
            <Link href="/auth/register" asChild>
              <Pressable>
                <Text style={styles.link}>Create account</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.noteBox}>
            <Feather name="info" size={14} color={Colors.primary} />
            <Text style={styles.noteText}>
              Workers created by admins will be asked to complete their own role and location profile after first login.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: "500" as const },
  header: { alignItems: "center", marginBottom: 36 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  appName: { fontSize: 28, fontWeight: "700" as const, color: Colors.text, marginBottom: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgeText: { fontSize: 12, fontWeight: "600" as const, color: Colors.primary },
  tagline: { fontSize: 15, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    gap: 16,
  },
  formTitle: { fontSize: 22, fontWeight: "700" as const, color: Colors.text, marginBottom: 4 },
  formSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: -8, lineHeight: 20 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" as const, color: Colors.text },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: Colors.text },
  eyeIcon: { padding: 4 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: "600" as const },
  noteBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 14,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
});
