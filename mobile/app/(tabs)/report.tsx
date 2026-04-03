import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  classifyApi,
  issuesApi,
  uploadApi,
  type IssueCategory,
  type IssuePriority,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = [
  { value: "garbage" as IssueCategory, label: "Garbage", icon: "trash-2" },
  { value: "pothole" as IssueCategory, label: "Pothole", icon: "alert-triangle" },
  { value: "water_leakage" as IssueCategory, label: "Water Leakage", icon: "droplet" },
  { value: "other" as IssueCategory, label: "Other", icon: "help-circle" },
];

const PRIORITIES = [
  { value: "high" as IssuePriority, label: "High", color: Colors.priorityHigh, bg: Colors.priorityHighBg },
  { value: "medium" as IssuePriority, label: "Medium", color: Colors.priorityMedium, bg: Colors.priorityMediumBg },
  { value: "low" as IssuePriority, label: "Low", color: Colors.priorityLow, bg: Colors.priorityLowBg },
];

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const topPadding = Platform.OS === "web" ? 67 : 0;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IssueCategory>("garbage");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [captureLocation, setCaptureLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [imageSource, setImageSource] = useState<"camera" | "gallery" | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      issuesApi.create({
        title,
        description,
        category,
        priority,
        imageUrl: imageUrl!,
        latitude: location!.lat,
        longitude: location!.lng,
        address: location?.address,
        imageSource: imageSource!,
        captureLatitude: captureLocation?.lat,
        captureLongitude: captureLocation?.lng,
      }),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["map-issues"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Issue Reported!", "Your issue has been submitted successfully.", [
        { text: "View Issue", onPress: () => router.push(`/issue/${issue.id}`) },
        { text: "Report Another", onPress: resetForm },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Verification failed", err.message || "Could not report issue");
    },
  });

  function resetForm() {
    setTitle(""); setDescription(""); setCategory("garbage"); setPriority("medium");
    setImageUri(null); setImageUrl(null); setLocation(null); setCaptureLocation(null); setImageSource(null);
  }

  async function detectCaptureLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      return null;
    }
  }

  async function takePhoto() {
    if (!user) { router.push("/auth/login"); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Please allow camera access."); return; }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7, base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageSource("camera");
      setCaptureLocation(await detectCaptureLocation());
      await uploadAndClassify(asset.base64!, asset.mimeType || "image/jpeg");
    }
  }

  async function uploadAndClassify(base64: string, mimeType: string) {
    try {
      setUploadingImage(true);
      const uploadResult = await uploadApi.upload(base64, mimeType);
      await issuesApi.verifyImage({ imageUrl: uploadResult.imageUrl, imageSource: "camera" });
      setImageUrl(uploadResult.imageUrl);
      setClassifying(true);
      try {
        const cls = await classifyApi.classify(uploadResult.imageUrl);
        setCategory(cls.category);
        setPriority(cls.priority);
        if (!title) setTitle(cls.description.slice(0, 80));
      } catch {}
    } catch (err: any) {
      const message = err?.message || "Could not verify this image";
      setImageUri(null);
      setImageUrl(null);
      setImageSource(null);
      setCaptureLocation(null);
      Alert.alert("Invalid image", message);
    } finally {
      setUploadingImage(false);
      setClassifying(false);
    }
  }

  async function getLocation() {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (Platform.OS === "web") {
          navigator.geolocation?.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => Alert.alert("Location unavailable"),
          );
        } else {
          Alert.alert("Permission needed", "Allow location access to auto-detect your position.");
        }
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const address = geo ? `${geo.street || ""}, ${geo.city || ""}, ${geo.region || ""}`.replace(/^, |, $/g, "") : undefined;
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude, address });
    } catch {
      Alert.alert("Could not get location");
    } finally {
      setGettingLocation(false);
    }
  }

  function handleSubmit() {
    if (!user) { router.push("/auth/login"); return; }
    if (!title.trim()) { Alert.alert("Missing title", "Please add a title."); return; }
    if (!description.trim()) { Alert.alert("Missing description", "Please describe the issue."); return; }
    if (!imageUrl) { Alert.alert("No image", "Please attach an image."); return; }
    if (!location) { Alert.alert("No location", "Please detect your location."); return; }
    if (!imageSource) { Alert.alert("Missing media source", "Please capture a live image with your camera."); return; }
    mutation.mutate();
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        <Text style={styles.heading}>Report Issue</Text>
        <Text style={styles.subheading}>Help improve your community</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photo *</Text>
        <Text style={styles.sectionHelper}>
          Capture a live photo of the civic issue. Gallery uploads are disabled and invalid images are rejected.
        </Text>
        {imageUri ? (
          <View>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            {(uploadingImage || classifying) && (
              <View style={styles.imageBadge}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.imageBadgeText}>{uploadingImage ? "Uploading..." : "Classifying..."}</Text>
              </View>
            )}
            <Pressable style={styles.changeImageBtn} onPress={takePhoto}>
              <Feather name="edit-2" size={14} color={Colors.primary} />
              <Text style={styles.changeImageText}>Retake photo</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.imageButtons}>
            <Pressable style={styles.imageBtn} onPress={takePhoto}>
              <Feather name="camera" size={22} color={Colors.primary} />
              <Text style={styles.imageBtnText}>Camera</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.value}
              style={[styles.catChip, category === cat.value && styles.catChipActive]}
              onPress={() => setCategory(cat.value)}
            >
              <Feather name={cat.icon as any} size={18} color={category === cat.value ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.catText, category === cat.value && styles.catTextActive]}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p.value}
              style={[styles.prioChip, priority === p.value && { backgroundColor: p.bg, borderColor: p.color }]}
              onPress={() => setPriority(p.value)}
            >
              <Text style={[styles.prioText, priority === p.value && { color: p.color }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Title *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Brief description of the issue"
          placeholderTextColor={Colors.placeholder}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description *</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Describe the issue in detail..."
          placeholderTextColor={Colors.placeholder}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location *</Text>
        <Pressable style={styles.locationBtn} onPress={getLocation} disabled={gettingLocation}>
          {gettingLocation ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Feather name="map-pin" size={20} color={location ? Colors.success : Colors.primary} />
          )}
          <Text style={[styles.locationText, location && { color: Colors.success }]}>
            {gettingLocation ? "Detecting..." : location ? `${location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}` : "Detect My Location"}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="send" size={18} color="#fff" />
            <Text style={styles.submitText}>Submit Report</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 16 },
  headerSection: { paddingVertical: 20 },
  heading: { fontSize: 26, fontWeight: "700" as const, color: Colors.text },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "600" as const, color: Colors.text, marginBottom: 10 },
  sectionHelper: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10, lineHeight: 18 },
  imageButtons: { flexDirection: "row", gap: 12 },
  imageBtn: {
    flex: 1, height: 120, borderRadius: 16, borderWidth: 2, borderColor: Colors.border,
    borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.surface,
  },
  imageBtnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" as const },
  previewImage: { width: "100%", height: 200, borderRadius: 16, backgroundColor: Colors.borderLight },
  imageBadge: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 8, borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  imageBadgeText: { color: "#fff", fontSize: 13 },
  changeImageBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 8 },
  changeImageText: { color: Colors.primary, fontSize: 14, fontWeight: "500" as const },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  catChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  catText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" as const },
  catTextActive: { color: Colors.primary },
  priorityRow: { flexDirection: "row", gap: 10 },
  prioChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  prioText: { fontSize: 14, fontWeight: "600" as const, color: Colors.textSecondary },
  textInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14,
    fontSize: 16, color: Colors.text, backgroundColor: Colors.surface,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  locationBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 16, borderRadius: 12, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  locationText: { fontSize: 15, color: Colors.primary, fontWeight: "500" as const, flex: 1 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16, height: 56, marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { fontSize: 17, fontWeight: "600" as const, color: "#fff" },
});
