import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type MapPressEvent, type MarkerDragStartEndEvent } from "react-native-maps";
import Colors from "@/constants/colors";

interface Props {
  latitude: number;
  longitude: number;
  onChange: (coords: { lat: number; lng: number }) => void;
}

export default function LocationPickerMap({ latitude, longitude, onChange }: Props) {
  const handleMapPress = (event: MapPressEvent) => {
    onChange({
      lat: event.nativeEvent.coordinate.latitude,
      lng: event.nativeEvent.coordinate.longitude,
    });
  };

  const handleMarkerDragEnd = (event: MarkerDragStartEndEvent) => {
    onChange({
      lat: event.nativeEvent.coordinate.latitude,
      lng: event.nativeEvent.coordinate.longitude,
    });
  };

  return (
    <View style={styles.wrapper}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          draggable
          onDragEnd={handleMarkerDragEnd}
          pinColor={Colors.primary}
        />
      </MapView>
      <Text style={styles.helper}>Tap anywhere on the map or drag the pin to adjust the issue location.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  map: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.borderLight,
  },
  helper: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
});
