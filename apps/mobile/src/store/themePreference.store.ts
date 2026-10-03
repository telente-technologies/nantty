import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import { storageKeys } from "@/constants/storageKeys.constant";

export type ThemePreference = "light" | "dark" | "system";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

const isThemePreference = (value: unknown): value is ThemePreference => value === "light" || value === "dark" || value === "system";

const readStoredThemePreferenceSynchronously = (): ThemePreference => {
  try {
    const stored = Platform.OS === "web" ? globalThis.localStorage?.getItem(storageKeys.themePreference) : SecureStore.getItem(storageKeys.themePreference);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
};

const writeStoredThemePreference = (preference: ThemePreference) => {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(storageKeys.themePreference, preference);
    else SecureStore.setItem(storageKeys.themePreference, preference);
  } catch {
    return;
  }
};

interface ThemePreferenceState {
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
}

export const useThemePreferenceStore = create<ThemePreferenceState>()((set) => ({
  preference: readStoredThemePreferenceSynchronously(),
  setPreference: (preference) => {
    writeStoredThemePreference(preference);
    set({ preference });
  },
}));
