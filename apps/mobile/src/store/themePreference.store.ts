import { create } from "zustand";

import { storageKeys } from "@/constants/storageKeys.constant";
import { readDevicePreference, writeDevicePreference } from "@/utils/devicePreferenceStorage.util";
import { retryWhenAppComesToForeground } from "@/utils/secureStorage.util";

export type ThemePreference = "light" | "dark" | "system";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

const isThemePreference = (value: unknown): value is ThemePreference => value === "light" || value === "dark" || value === "system";

const readStoredThemePreferenceSynchronously = (): ThemePreference | null => {
  const stored = readDevicePreference(storageKeys.themePreference);
  if (!stored.available) return null;
  return isThemePreference(stored.value) ? stored.value : DEFAULT_THEME_PREFERENCE;
};

interface ThemePreferenceState {
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
}

const preferenceReadAtLaunch = readStoredThemePreferenceSynchronously();
let hasChosenPreferenceSinceLaunch = false;

export const useThemePreferenceStore = create<ThemePreferenceState>()((set) => ({
  preference: preferenceReadAtLaunch ?? DEFAULT_THEME_PREFERENCE,
  setPreference: (preference) => {
    hasChosenPreferenceSinceLaunch = true;
    writeDevicePreference(storageKeys.themePreference, preference);
    set({ preference });
  },
}));

if (preferenceReadAtLaunch === null) {
  retryWhenAppComesToForeground(() => {
    if (hasChosenPreferenceSinceLaunch) return true;
    const preference = readStoredThemePreferenceSynchronously();
    if (preference === null) return false;
    useThemePreferenceStore.setState({ preference });
    return true;
  });
}
