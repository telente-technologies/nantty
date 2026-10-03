import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import type { SharedLocation } from "@/types";

const LOCATION_CONSENT_STORAGE_KEY = "zudomart.chatLocationConsent.v1";

export type LocationAccessResult = "granted" | "denied" | "blocked";

export const readChatLocationConsent = async () => {
  try {
    return (await AsyncStorage.getItem(LOCATION_CONSENT_STORAGE_KEY)) === "accepted";
  } catch {
    return false;
  }
};

export const saveChatLocationConsent = async () => {
  try {
    await AsyncStorage.setItem(LOCATION_CONSENT_STORAGE_KEY, "accepted");
  } catch {
    return;
  }
};

export async function requestLocationAccess(): Promise<LocationAccessResult> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return "granted";
  if (!current.canAskAgain) return "blocked";
  const requested = await Location.requestForegroundPermissionsAsync();
  if (requested.granted) return "granted";
  return requested.canAskAgain ? "denied" : "blocked";
}

const describeAddress = (place: Location.LocationGeocodedAddress | undefined) => {
  if (!place) return null;
  const street = [place.streetNumber, place.street].filter(Boolean).join(" ") || place.name;
  const parts = [street, place.district ?? place.subregion, place.city ?? place.region].filter((part): part is string => !!part);
  return [...new Set(parts)].join(", ") || null;
};

export async function readAddressForCoordinates(latitude: number, longitude: number): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return describeAddress(place);
  } catch {
    return null;
  }
}

export async function readCurrentSharedLocation(): Promise<SharedLocation> {
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;
  return { latitude, longitude, address: await readAddressForCoordinates(latitude, longitude), updatedAt: new Date().toISOString() };
}
