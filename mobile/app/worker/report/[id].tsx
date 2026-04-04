import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { issuesApi, uploadApi, workersApi } from "@/lib/api";
import { getStatusLabel } from "@/lib/utils";

export default function WorkerReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const issueId = Number(id);
  const { data: issue } = useQuery({
    queryKey: ["issue", id],
    queryFn: () => issuesApi.getById(issueId),
    enabled: Number.isFinite(issueId),
  });

  const isReadOnly = issue?.status === "closed" || issue?.status === "resolved";

  async function captureProof() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access for worker proof capture.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (result.canceled || !result.assets[0]) {
      return;
    }

    setImageUri(result.assets[0].uri);
    if (result.assets[0].base64) {
      const upload = await uploadApi.upload(result.assets[0].base64, result.assets[0].mimeType || "image/jpeg");
      setImageUrl(upload.imageUrl);
    }
  }

  async function submit() {
    if (!id || !note.trim()) {
      Alert.alert("Missing note", "Add a daily progress note before submitting.");
      return;
    }

    if (isReadOnly) {
      Alert.alert("Issue closed", "This issue is closed for further updates.");
      return;
    }

    try {
      setSubmitting(true);
      await workersApi.submitReport(Number(id), {
        note: note.trim(),
        status,
        imageUrl,
      });
      Alert.alert("Report submitted", "Daily worker update sent to admin tracking.");
      router.replace("/worker" as never);
    } catch (error: any) {
      Alert.alert("Submit failed", error.message || "Could not send worker report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.heading}>Daily Worker Report</Text>
      <Text style={styles.subheading}>Update what you completed today and attach fresh proof.</Text>

      <View style={styles.card}>
        {isReadOnly ? (
          <View style={styles.readOnlyBox}>
            <Text style={styles.readOnlyTitle}>Updates locked</Text>
            <Text style={styles.readOnlyText}>This issue is already {getStatusLabel(issue?.status || "closed").toLowerCase()}. You can only view history now.</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Today&apos;s progress</Text>
        <TextInput
          style={styles.textArea}
          value={note}
          onChangeText={setNote}
          placeholder="Describe work completed today"
          placeholderTextColor={Colors.placeholder}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Task status</Text>
        <View style={styles.row}>
          {["in_progress", "completed"].map((item) => (
            <Pressable key={item} style={[styles.chip, status === item && styles.chipActive]} onPress={() => setStatus(item)}>
              <Text style={[styles.chipText, status === item && styles.chipTextActive]}>{item.replace(/_/g, " ")}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={[styles.captureBtn, isReadOnly && styles.submitDisabled]} onPress={captureProof} disabled={isReadOnly}>
          <Text style={styles.captureText}>{imageUri ? "Retake proof image" : "Capture proof image"}</Text>
        </Pressable>

        {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}

        <Pressable style={[styles.submitBtn, (submitting || isReadOnly) && styles.submitDisabled]} onPress={submit} disabled={submitting || isReadOnly}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Daily Report</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: "800" as const, color: Colors.text, marginTop: 18 },
  subheading: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 24, padding: 20, gap: 14 },
  readOnlyBox: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: Colors.successLight,
    gap: 4,
  },
  readOnlyTitle: { fontSize: 14, fontWeight: "800" as const, color: Colors.success },
  readOnlyText: { fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  label: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
  textArea: {
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    padding: 14,
    color: Colors.text,
  },
  row: { flexDirection: "row", gap: 10 },
  chip: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: 12, alignItems: "center" },
  chipActive: { borderColor: Colors.warning, backgroundColor: Colors.warningLight },
  chipText: { color: Colors.textSecondary, fontWeight: "600" as const },
  chipTextActive: { color: Colors.warning },
  captureBtn: { backgroundColor: Colors.warningLight, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  captureText: { color: Colors.warning, fontWeight: "700" as const },
  image: { width: "100%", height: 220, borderRadius: 16, backgroundColor: Colors.borderLight },
  submitBtn: { backgroundColor: Colors.warning, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontWeight: "700" as const, fontSize: 16 },
});
