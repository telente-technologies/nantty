import * as SystemUI from "expo-system-ui";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";

import { useThemePreferenceStore } from "@/store/themePreference.store";

import { themeColorsByScheme, type ColorSchemeName, type ThemeColors } from "./themeColors.constant";

export interface Theme {
  readonly scheme: ColorSchemeName;
  readonly colors: ThemeColors;
  readonly isDark: boolean;
}

const buildTheme = (scheme: ColorSchemeName): Theme => ({ scheme, colors: themeColorsByScheme[scheme], isDark: scheme === "dark" });

const themesByScheme: Readonly<Record<ColorSchemeName, Theme>> = { light: buildTheme("light"), dark: buildTheme("dark") };

const ThemeContext = createContext<Theme>(themesByScheme.light);

const applyNativeChromeForScheme = (preference: string, scheme: ColorSchemeName) => {
  if (Platform.OS !== "web") {
    try {
      Appearance.setColorScheme(preference === "system" ? "unspecified" : scheme);
    } catch {
      return;
    }
  }
  SystemUI.setBackgroundColorAsync(themeColorsByScheme[scheme].background).catch(() => undefined);
};

export function useResolvedColorScheme(): ColorSchemeName {
  const preference = useThemePreferenceStore((state) => state.preference);
  const systemScheme = useColorScheme();
  if (preference !== "system") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const preference = useThemePreferenceStore((state) => state.preference);
  const scheme = useResolvedColorScheme();

  useEffect(() => {
    applyNativeChromeForScheme(preference, scheme);
  }, [preference, scheme]);

  return <ThemeContext.Provider value={themesByScheme[scheme]}>{children}</ThemeContext.Provider>;
}

export function ForcedColorSchemeScope({ scheme, children }: { readonly scheme: ColorSchemeName; readonly children: ReactNode }) {
  const value = useMemo(() => themesByScheme[scheme], [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
