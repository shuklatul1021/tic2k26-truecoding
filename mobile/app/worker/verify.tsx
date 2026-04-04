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
import * as Location from "expo-location";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRoute } from "@/lib/auth-routing";

function buildAddress(address: Location.LocationGeocodedAddress | null | undefined) {
  if (!address) {
    return "";
  }

  const parts = [
    address.name,
    address.street,
    address.district,
    address.city,
    address.subregion,
    address.region,
    address.postalCode,
    address.country,
  ].filter(Boolean);

  return parts.join(", ");
}

export default function WorkerVerifyScreen() {
  const insets = useSafeAreaInsets();
  const { user, verifyWorker, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [roleTitle, setRoleTitle] = useState("");
  const [skills, setSkills] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [workLatitude, setWorkLatitude] = useState<number | undefined>(undefined);
  const [workLongitude, setWorkLongitude] = useState<number | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    await logout();
  }

  async function detectLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Allow location access to finish worker setup.");
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
        setWorkAddress(buildAddress(geo));
      }
    } catch {
      Alert.alert("Location failed", "Could not detect work location.");
    }
  }

  async function handleVerify() {
    const parsedSkills = skills
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!name.trim() || !roleTitle.trim() || parsedSkills.length === 0 || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Missing fields", "Fill name, role, skills and a new password to continue.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "The passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const verifiedUser = await verifyWorker({
        name: name.trim(),
        password,
        roleTitle: roleTitle.trim(),
        skills: parsedSkills,
        workLatitude,
        workLongitude,
        workAddress: workAddress.trim() || undefined,
      });
      router.replace(getPostAuthRoute(verifiedUser) as never);
    } catch (error: any) {
      Alert.alert("Setup failed", error.message || "Could not complete worker profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Feather name="tool" size={30} color={Colors.warning} />
          </View>
          <Text style={styles.title}>Complete Worker Profile</Text>
          <Text style={styles.subtitle}>
            You signed in with the shared worker account. Finish your role, location, and new password to activate it.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.accountPill}>
            <Feather name="mail" size={14} color={Colors.warning} />
            <Text style={styles.accountPillText}>{user?.email}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your display name"
              placeholderTextColor={Colors.placeholder}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Worker Role</Text>
            <Text style={styles.helperText}>Example: Electrician, plumber, sanitation worker</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your worker role"
              placeholderTextColor={Colors.placeholder}
              value={roleTitle}
              onChangeText={setRoleTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skills</Text>
            <TextInput
              style={styles.input}
              placeholder="Comma separated skills"
              placeholderTextColor={Colors.placeholder}
              value={skills}
              onChangeText={setSkills}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Work Address</Text>
            <TextInput
              style={[styles.input, styles.addressInput]}
              placeholder="Primary service area or full work address"
              placeholderTextColor={Colors.placeholder}
              value={workAddress}
              onChangeText={setWorkAddress}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Pressable style={styles.locationBtn} onPress={detectLocation}>
            <Feather name="map-pin" size={18} color={Colors.warning} />
            <Text style={styles.locationText}>
              {workAddress.trim()
                ? workAddress
                : workLatitude && workLongitude
                  ? `${workLatitude.toFixed(5)}, ${workLongitude.toFixed(5)}`
                  : "Use my current address"}
            </Text>
          </Pressable>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={styles.passwordField}
                placeholder="Minimum 6 characters"
                placeholderTextColor={Colors.placeholder}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter your new password"
              placeholderTextColor={Colors.placeholder}
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          <Pressable style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={handleVerify} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save And Continue</Text>}
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleLogout}>
            <Text style={styles.secondaryButtonText}>Use a different account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, gap: 20 },
  header: { alignItems: "center", gap: 10, marginTop: 12 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 28, fontWeight: "800" as const, color: Colors.text, textAlign: "center" },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, textAlign: "center" },
  card: { backgroundColor: Colors.surface, borderRadius: 24, padding: 22, gap: 16 },
  accountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: Colors.warningLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accountPillText: { color: Colors.warning, fontWeight: "700" as const },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
  helperText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 16,
    color: Colors.text,
    textAlignVertical: "center",
  },
  addressInput: {
    minHeight: 86,
    height: 86,
    paddingTop: 13,
    paddingBottom: 13,
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.warningLight,
  },
  locationText: { color: Colors.warning, fontWeight: "600" as const, flex: 1, lineHeight: 20 },
  passwordInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  passwordField: { flex: 1, color: Colors.text, fontSize: 16, paddingVertical: 0 },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  secondaryButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: Colors.textSecondary, fontWeight: "600" as const },
  buttonDisabled: { opacity: 0.7 },
});
