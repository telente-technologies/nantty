import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { storageKeys } from "@/constants/storageKeys.constant";

const SEEN = "1";

const accountKeyFor = (userId: string) => `${storageKeys.clipGestureTipsSeen}.${userId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

const readFlag = (key: string): boolean => {
  try {
    const stored = Platform.OS === "web" ? globalThis.localStorage?.getItem(key) : SecureStore.getItem(key);
    return stored === SEEN;
  } catch {
    return false;
  }
};

const writeFlag = (key: string) => {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, SEEN);
    else SecureStore.setItem(key, SEEN);
  } catch {
    return;
  }
};

export function shouldShowClipGestureTips(userId: string | null): boolean {
  if (!readFlag(storageKeys.clipGestureTipsSeen)) return true;
  return userId !== null && !readFlag(accountKeyFor(userId));
}

export function rememberClipGestureTipsSeen(userId: string | null) {
  writeFlag(storageKeys.clipGestureTipsSeen);
  if (userId !== null) writeFlag(accountKeyFor(userId));
}
