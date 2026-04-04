import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

interface Props {
  latitude: number;
  longitude: number;
  onChange?: (coords: { lat: number; lng: number }) => void;
}

export default function LocationPickerMap({ latitude, longitude }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>Map pinning is available in the mobile app</Text>
        <Text style={styles.coords}>
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </Text>
      </View>
      <Text style={styles.helper}>On web, use the detected location above. In the mobile app you can move the pin and confirm it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  placeholder: {
    minHeight: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: "700" as const, color: Colors.text, textAlign: "center" },
  coords: { fontSize: 14, color: Colors.primary, fontWeight: "600" as const },
  helper: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
});
