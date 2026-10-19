import { storageKeys } from "@/constants/storageKeys.constant";
import { readDevicePreference, writeDevicePreference } from "@/utils/devicePreferenceStorage.util";

const SEEN = "1";

const accountKeyFor = (userId: string) => `${storageKeys.clipGestureTipsSeen}.${userId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

const readFlag = (key: string): boolean => {
  const stored = readDevicePreference(key);
  return stored.available && stored.value === SEEN;
};

const writeFlag = (key: string) => writeDevicePreference(key, SEEN);

export function shouldShowClipGestureTips(userId: string | null): boolean {
  if (!readFlag(storageKeys.clipGestureTipsSeen)) return true;
  return userId !== null && !readFlag(accountKeyFor(userId));
}

export function rememberClipGestureTipsSeen(userId: string | null) {
  writeFlag(storageKeys.clipGestureTipsSeen);
  if (userId !== null) writeFlag(accountKeyFor(userId));
}
