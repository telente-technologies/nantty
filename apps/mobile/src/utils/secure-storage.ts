import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memory = new Map<string, string>();

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return memory.get(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      memory.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      memory.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
