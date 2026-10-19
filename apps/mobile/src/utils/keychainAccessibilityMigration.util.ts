import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { storageKeys } from "@/constants/storageKeys.constant";
import { moveSecureItemToAccess } from "@/utils/secureStorage.util";

const migrationFlagKey = "zm.sessionKeychainBackgroundReadable";

/**
 * Older builds wrote the session tokens with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
 * Widgets and other background readers need `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`,
 * so move both tokens once. The flag is written only after the move succeeds, and
 * the operation is idempotent if the app is killed midway.
 */
export async function moveSessionKeychainItemsToBackgroundReadableAccessOnce(): Promise<void> {
  if (Platform.OS === "web") return;
  const alreadyMoved = await SecureStore.getItemAsync(migrationFlagKey).catch(() => null);
  if (alreadyMoved === "done") return;
  await Promise.all([
    moveSecureItemToAccess(storageKeys.accessToken, "backgroundReadableDeviceOnly"),
    moveSecureItemToAccess(storageKeys.refreshToken, "backgroundReadableDeviceOnly"),
  ]);
  await SecureStore.setItemAsync(migrationFlagKey, "done");
}
