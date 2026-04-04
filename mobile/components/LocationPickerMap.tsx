import { Platform } from "react-native";
import NativeLocationPickerMap from "./LocationPickerMap.native";
import WebLocationPickerMap from "./LocationPickerMap.web";

const LocationPickerMap = Platform.OS === "web" ? WebLocationPickerMap : NativeLocationPickerMap;

export default LocationPickerMap;
