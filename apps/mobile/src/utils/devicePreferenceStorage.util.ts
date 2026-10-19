import { Platform } from "react-native";

import { readSecureItemSynchronously, type SynchronousSecureRead, writeSecureItemSynchronously } from "./secureStorage.util";

export function readDevicePreference(key: string): SynchronousSecureRead {
  if (Platform.OS !== "web") return readSecureItemSynchronously(key);
  try {
    return { available: true, value: globalThis.localStorage?.getItem(key) ?? null };
  } catch {
    return { available: false };
  }
}

export function writeDevicePreference(key: string, value: string): void {
  if (Platform.OS !== "web") {
    writeSecureItemSynchronously(key, value, "backgroundReadablePreference");
    return;
  }
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    return;
  }
}
