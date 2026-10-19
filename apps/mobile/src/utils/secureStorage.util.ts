import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

export type SecureStorageAccess = "unlockedDeviceOnly" | "backgroundReadableDeviceOnly" | "backgroundReadablePreference";

const keychainAccessibleByAccess: Record<SecureStorageAccess, SecureStore.KeychainAccessibilityConstant> = {
  unlockedDeviceOnly: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  backgroundReadableDeviceOnly: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  backgroundReadablePreference: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureStoreOptionsFor = (access: SecureStorageAccess): SecureStore.SecureStoreOptions => ({
  keychainAccessible: keychainAccessibleByAccess[access],
});

export class SecureStorageUnavailableError extends Error {
  constructor(readonly key: string) {
    super(`Secure storage cannot be read yet for ${key}`);
    this.name = "SecureStorageUnavailableError";
  }
}

export type SynchronousSecureRead = { readonly available: true; readonly value: string | null } | { readonly available: false };

const keychainLockedMessagePattern = /interaction is not allowed/i;

export const isKeychainLockedError = (error: unknown) =>
  AppState.currentState !== "active" || keychainLockedMessagePattern.test(error instanceof Error ? error.message : String(error));

export function readSecureItemSynchronously(key: string): SynchronousSecureRead {
  try {
    return { available: true, value: SecureStore.getItem(key) };
  } catch {
    return { available: false };
  }
}

export function writeSecureItemSynchronously(key: string, value: string, access: SecureStorageAccess): boolean {
  try {
    SecureStore.setItem(key, value, secureStoreOptionsFor(access));
    return true;
  } catch {
    return false;
  }
}

export function retryWhenAppComesToForeground(attemptUntilDone: () => boolean): void {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active" && attemptUntilDone()) subscription.remove();
  });
}

export async function moveSecureItemToAccess(key: string, access: SecureStorageAccess): Promise<void> {
  const value = await SecureStore.getItemAsync(key);
  if (value === null) return;
  await SecureStore.deleteItemAsync(key);
  const options = secureStoreOptionsFor(access);
  await SecureStore.setItemAsync(key, value, options).catch(() => SecureStore.setItemAsync(key, value, options));
}

const memory = new Map<string, string>();

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return memory.get(key) ?? null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      if (isKeychainLockedError(error)) throw new SecureStorageUnavailableError(key);
      throw error;
    }
  },
  async set(key: string, value: string, access: SecureStorageAccess = "unlockedDeviceOnly"): Promise<void> {
    if (Platform.OS === "web") {
      memory.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, secureStoreOptionsFor(access));
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      memory.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
