import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform, Image,
} from "react-native";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import LocationPickerMap from "@/components/LocationPickerMap";
import {
  issuesApi,
  uploadApi,
  type IssueCategory,
  type IssuePriority,
  type VerificationDetails,
  type ImageSource,
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

type ReportLocation = {
  lat: number;
  lng: number;
  address?: string;
  confirmed: boolean;
};

function formatPercent(value?: number | null) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function formatCoverage(value?: number | null) {
  return `${Math.round(value ?? 0)}%`;
}

function formatDensity(value?: number | null) {
  return Number(value ?? 0).toFixed(2);
}

function buildAddress(address: Location.LocationGeocodedAddress | null | undefined) {
  if (!address) {
    return undefined;
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

function buildSuggestedTitle(verification: VerificationDetails) {
  const subject = verification.imageSubject?.trim();
  if (subject) {
    return subject.slice(0, 100);
  }

  switch (verification.category) {
    case "garbage":
      return "Garbage accumulation reported";
    case "pothole":
      return "Pothole reported on road";
    case "water_leakage":
      return "Water leakage reported";
    default:
      return "Civic issue reported";
  }
}

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
  const [location, setLocation] = useState<ReportLocation | null>(null);
  const [captureLocation, setCaptureLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [imageSource, setImageSource] = useState<ImageSource | null>(null);
  const [verifyingImage, setVerifyingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageVerification, setImageVerification] = useState<VerificationDetails | null>(null);

  const isProcessingImage = uploadingImage || verifyingImage;

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
      resetForm();
      Alert.alert("Issue Reported!", "Your issue has been submitted successfully.", [
        { text: "View Issue", onPress: () => router.push(`/issue/${issue.id}`) },
        { text: "Report Another" },
      ]);
    },
    onError: (err: Error & { data?: { verification?: VerificationDetails } }) => {
      if (err.data?.verification) {
        setImageVerification(err.data.verification);
        setImageError(err.message);
      }
      Alert.alert("Verification failed", err.message || "Could not report issue");
    },
  });

  const canSubmit = Boolean(
    !mutation.isPending &&
    !isProcessingImage &&
    title.trim() &&
    description.trim() &&
    imageUrl &&
    imageSource &&
    imageVerification?.accepted &&
    location?.confirmed,
  );

  const verificationRows = useMemo(() => {
    if (!imageVerification) {
      return [];
    }

    return [
      { label: "Real image", value: imageVerification.isRealImage ? "Yes" : "No" },
      { label: "Detected issue", value: imageVerification.detected ? "Yes" : "No" },
      { label: "Image shows", value: imageVerification.imageSubject || "Unknown" },
      { label: "Authenticity confidence", value: formatPercent(imageVerification.authenticityConfidence) },
      { label: "Model confidence", value: formatPercent(imageVerification.confidence) },
      { label: "Coverage", value: formatCoverage(imageVerification.coveragePercentage) },
      { label: "Density score", value: formatDensity(imageVerification.densityScore) },
      { label: "Category", value: imageVerification.category.replace(/_/g, " ") },
      { label: "Priority", value: imageVerification.priority },
    ];
  }, [imageVerification]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("garbage");
    setPriority("medium");
    setImageUri(null);
    setImageUrl(null);
    setLocation(null);
    setCaptureLocation(null);
    setImageSource(null);
    setImageError(null);
    setImageVerification(null);
  }

  async function reverseGeocode(latitude: number, longitude: number) {
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      return buildAddress(geo);
    } catch {
      return undefined;
    }
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

  function applyPickedImage(uri: string, source: ImageSource) {
    setImageError(null);
    setImageVerification(null);
    setImageUrl(null);
    setImageUri(uri);
    setImageSource(source);
  }

  async function takePhoto() {
    if (!user) { router.push("/auth/login"); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Please allow camera access."); return; }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      applyPickedImage(asset.uri, "camera");
      setCaptureLocation(await detectCaptureLocation());
      await uploadAndVerify(asset.base64!, asset.mimeType || "image/jpeg", "camera");
    }
  }

  async function pickFromGallery() {
    if (!user) { router.push("/auth/login"); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Please allow gallery access."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      applyPickedImage(asset.uri, "gallery");
      setCaptureLocation(null);
      await uploadAndVerify(asset.base64!, asset.mimeType || "image/jpeg", "gallery");
    }
  }

  async function uploadAndVerify(base64: string, mimeType: string, source: ImageSource) {
    try {
      setUploadingImage(true);
      const uploadResult = await uploadApi.upload(base64, mimeType);
      setUploadingImage(false);
      setVerifyingImage(true);

      const verification = await issuesApi.verifyImage({
        imageUrl: uploadResult.imageUrl,
        imageSource: source,
      });

      setImageUrl(uploadResult.imageUrl);
      setImageVerification(verification);
      setImageError(null);
      setCategory(verification.category);
      setPriority(verification.priority);
      if (!title.trim()) {
        setTitle(buildSuggestedTitle(verification));
      }
      if (!description.trim() && verification.explanation?.trim()) {
        setDescription(verification.explanation.trim());
      }
    } catch (err: any) {
      const verification = err?.data?.verification as VerificationDetails | undefined;
      const message = err?.message || "Could not verify this image";
      setImageUrl(null);
      setImageVerification(verification || null);
      setImageError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploadingImage(false);
      setVerifyingImage(false);
    }
  }

  async function getLocation() {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (Platform.OS === "web") {
          navigator.geolocation?.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, confirmed: false }),
            () => Alert.alert("Location unavailable"),
          );
        } else {
          Alert.alert("Permission needed", "Allow location access to auto-detect your position.");
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const address = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        address,
        confirmed: false,
      });
    } catch {
      Alert.alert("Could not get location");
    } finally {
      setGettingLocation(false);
    }
  }

  function handleLocationPinChange(coords: { lat: number; lng: number }) {
    setLocation(() => ({
      lat: coords.lat,
      lng: coords.lng,
      address: undefined,
      confirmed: false,
    }));
  }

  async function confirmPinnedLocation() {
    if (!location) {
      return;
    }

    setResolvingAddress(true);
    try {
      const address = await reverseGeocode(location.lat, location.lng);
      setLocation((current) => current
        ? {
            ...current,
            address,
            confirmed: true,
          }
        : current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setResolvingAddress(false);
    }
  }

  function handleSubmit() {
    if (!user) { router.push("/auth/login"); return; }
    if (!title.trim()) { Alert.alert("Missing title", "Please add a title."); return; }
    if (!description.trim()) { Alert.alert("Missing description", "Please describe the issue."); return; }
    if (isProcessingImage) { Alert.alert("Image processing", "Wait for image verification to finish."); return; }
    if (!imageUrl) { Alert.alert("No image", "Please attach an image."); return; }
    if (!imageVerification?.accepted) { Alert.alert("Verification required", "Upload a valid issue image and wait for verification."); return; }
    if (!location) { Alert.alert("No location", "Please detect your location."); return; }
    if (!location.confirmed) { Alert.alert("Confirm location", "Please pin the issue location on the map and confirm it."); return; }
    if (!imageSource) { Alert.alert("Missing media source", "Please attach an image."); return; }
    mutation.mutate();
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={[styles.container, { paddingTop: topPadding }]}
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(100, insets.bottom + 40) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.heading}>Report Issue</Text>
          <Text style={styles.subheading}>Upload the image, confirm the location pin, then submit the report.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo *</Text>
          <Text style={styles.sectionHelper}>
            Capture a live photo or upload an issue image from your gallery. Fake and unrelated images are rejected.
          </Text>
          {imageError ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{imageError}</Text>
            </View>
          ) : null}
          {imageUri ? (
            <View>
              <Image
                source={{ uri: imageUri }}
                style={[styles.previewImage, imageVerification && !imageVerification.accepted && styles.previewImageError]}
                resizeMode="cover"
              />
              {isProcessingImage && (
                <View style={styles.imageBadge}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.imageBadgeText}>{uploadingImage ? "Uploading..." : "Verifying..."}</Text>
                </View>
              )}
              <View style={styles.changeImageActions}>
                <Pressable style={styles.changeImageBtn} onPress={takePhoto}>
                  <Feather name="camera" size={14} color={Colors.primary} />
                  <Text style={styles.changeImageText}>Retake photo</Text>
                </Pressable>
                <Pressable style={styles.changeImageBtn} onPress={pickFromGallery}>
                  <Feather name="image" size={14} color={Colors.primary} />
                  <Text style={styles.changeImageText}>Choose from gallery</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.imageButtons}>
              <Pressable style={styles.imageBtn} onPress={takePhoto}>
                <Feather name="camera" size={22} color={Colors.primary} />
                <Text style={styles.imageBtnText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.imageBtn} onPress={pickFromGallery}>
                <Feather name="image" size={22} color={Colors.primary} />
                <Text style={styles.imageBtnText}>Gallery</Text>
              </Pressable>
            </View>
          )}
        </View>

        {imageVerification ? (
          <View
            style={[
              styles.verificationCard,
              imageVerification.accepted ? styles.verificationCardVerified : styles.verificationCardRejected,
            ]}
          >
            <View style={styles.verificationHeader}>
              <Text
                style={[
                  styles.verificationTitle,
                  imageVerification.accepted ? styles.verificationTitleVerified : styles.verificationTitleRejected,
                ]}
              >
                {imageVerification.accepted ? "Image Verified" : "Image Rejected"}
              </Text>
              <Text
                style={[
                  styles.verificationBadge,
                  imageVerification.accepted ? styles.verificationBadgeVerified : styles.verificationBadgeRejected,
                ]}
              >
                {imageVerification.verificationStatus}
              </Text>
            </View>
            <Text style={styles.verificationSummary}>{imageVerification.verificationSummary}</Text>
            <View style={styles.verificationGrid}>
              {verificationRows.map((row) => (
                <View key={row.label} style={styles.verificationRow}>
                  <Text style={styles.verificationLabel}>{row.label}</Text>
                  <Text style={styles.verificationValue}>{row.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.verificationNoteLabel}>Authenticity note</Text>
            <Text style={styles.verificationNote}>{imageVerification.authenticityExplanation || "No authenticity note available."}</Text>
            <Text style={styles.verificationNoteLabel}>Explanation</Text>
            <Text style={styles.verificationNote}>{imageVerification.explanation || "No detailed explanation available."}</Text>
          </View>
        ) : null}

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
          <Text style={styles.sectionHelper}>
            Detect your current location, move the pin if needed, then confirm the final issue location.
          </Text>
          <Pressable style={styles.locationBtn} onPress={getLocation} disabled={gettingLocation}>
            {gettingLocation ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Feather name="map-pin" size={20} color={location ? Colors.success : Colors.primary} />
            )}
            <Text style={[styles.locationText, location && { color: Colors.success }]}>
              {gettingLocation
                ? "Detecting..."
                : location
                  ? `${location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}`
                  : "Detect My Location"}
            </Text>
          </Pressable>

          {location ? (
            <View style={styles.locationCard}>
              <LocationPickerMap
                latitude={location.lat}
                longitude={location.lng}
                onChange={handleLocationPinChange}
              />
              <View style={styles.locationMeta}>
                <Text style={styles.locationMetaLabel}>Pinned coordinates</Text>
                <Text style={styles.locationMetaValue}>
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </Text>
              </View>
              <View style={styles.locationMeta}>
                <Text style={styles.locationMetaLabel}>Address</Text>
                <Text style={styles.locationMetaValue}>
                  {location.address || "Address will be resolved when you confirm the pin."}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.confirmLocationBtn,
                  location.confirmed && styles.confirmLocationBtnDone,
                ]}
                onPress={confirmPinnedLocation}
                disabled={resolvingAddress}
              >
                {resolvingAddress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name={location.confirmed ? "check-circle" : "crosshair"} size={16} color="#fff" />
                    <Text style={styles.confirmLocationText}>
                      {location.confirmed ? "Location Confirmed" : "Confirm Pinned Location"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[
            styles.submitBtn,
            (!canSubmit || mutation.isPending) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
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
        {!canSubmit ? (
          <Text style={styles.submitHelper}>
            Complete image verification and confirm the pinned location before submitting.
          </Text>
        ) : null}
      </ScrollView>

      {isProcessingImage ? (
        <View style={styles.loadingOverlay}>
          <BlurView intensity={40} tint="light" style={styles.loadingBlur} />
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTitle}>
              {uploadingImage ? "Uploading image..." : "Checking image..."}
            </Text>
            <Text style={styles.loadingSubtitle}>
              {uploadingImage
                ? "Please wait while we upload your photo."
                : "Please wait while we verify your photo and prepare the result."}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, position: "relative" },
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 16 },
  headerSection: { paddingVertical: 20 },
  heading: { fontSize: 26, fontWeight: "700" as const, color: Colors.text },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
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
  previewImageError: { borderWidth: 2, borderColor: Colors.danger },
  imageBadge: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 8, borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  imageBadgeText: { color: "#fff", fontSize: 13 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  errorBannerText: { flex: 1, fontSize: 13, lineHeight: 18, color: Colors.danger, fontWeight: "600" as const },
  changeImageActions: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingTop: 8 },
  changeImageBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  changeImageText: { color: Colors.primary, fontSize: 14, fontWeight: "500" as const },
  verificationCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    gap: 10,
  },
  verificationCardVerified: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  verificationCardRejected: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.danger,
  },
  verificationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  verificationTitle: { fontSize: 16, fontWeight: "700" as const },
  verificationTitleVerified: { color: Colors.success },
  verificationTitleRejected: { color: Colors.danger },
  verificationBadge: {
    textTransform: "capitalize",
    fontSize: 12,
    fontWeight: "700" as const,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  verificationBadgeVerified: { color: Colors.success, backgroundColor: "#ffffffaa" },
  verificationBadgeRejected: { color: Colors.danger, backgroundColor: "#ffffffaa" },
  verificationSummary: { fontSize: 14, color: Colors.text, lineHeight: 20, fontWeight: "600" as const },
  verificationGrid: { gap: 8 },
  verificationRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  verificationLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  verificationValue: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: "600" as const, textAlign: "right" },
  verificationNoteLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "700" as const, textTransform: "uppercase" },
  verificationNote: { fontSize: 13, lineHeight: 18, color: Colors.text },
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
  locationCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  locationMeta: { gap: 4 },
  locationMetaLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "700" as const, textTransform: "uppercase" },
  locationMetaValue: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  confirmLocationBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmLocationBtnDone: { backgroundColor: Colors.success },
  confirmLocationText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16, height: 56, marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitText: { fontSize: 17, fontWeight: "600" as const, color: "#fff" },
  submitHelper: { fontSize: 12, color: Colors.textSecondary, textAlign: "center", lineHeight: 18, marginBottom: 10 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(247, 248, 250, 0.2)",
  },
  loadingCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  loadingSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});

