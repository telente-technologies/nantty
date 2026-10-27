import { decodeBase64, encodeBase64, openString, sealString } from "@nantty/chat-crypto";
import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const localDataKeyName = "nantty.localData.key";
let cachedKey: Uint8Array | null = null;

function loadLocalDataKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  if (Platform.OS === "web") return (cachedKey = getRandomBytes(32));
  const saved = SecureStore.getItem(localDataKeyName);
  if (saved !== null) return (cachedKey = decodeBase64(saved));
  const created = getRandomBytes(32);
  SecureStore.setItem(localDataKeyName, encodeBase64(created), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return (cachedKey = created);
}

export const sealLocalText = (text: string, context: string): string => sealString(loadLocalDataKey(), text, context, getRandomBytes);

export function openLocalText(stored: string, context: string): string {
  try {
    return openString(loadLocalDataKey(), stored, context);
  } catch {
    return "";
  }
}

export const sealedAsyncStorage = (inner: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }) => ({
  getItem: async (key: string) => {
    const stored = await inner.getItem(key);
    return stored === null ? null : openLocalText(stored, `asyncStorage:${key}`) || null;
  },
  setItem: (key: string, value: string) => inner.setItem(key, sealLocalText(value, `asyncStorage:${key}`)),
  removeItem: (key: string) => inner.removeItem(key),
});
