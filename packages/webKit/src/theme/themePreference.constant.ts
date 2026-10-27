export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const themePreferences: readonly ThemePreference[] = ["light", "dark", "system"];
export const themeCookieName = "theme";
export const themeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;
export const themeChangedEventName = "nantty:theme-changed";
export const darkColorSchemeQuery = "(prefers-color-scheme: dark)";

export const themeColorByResolvedTheme: Record<ResolvedTheme, string> = { light: "#f7f8fe", dark: "#15161a" };

export const themeViewport: { colorScheme: "light dark"; themeColor: { media: string; color: string }[] } = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeColorByResolvedTheme.light },
    { media: "(prefers-color-scheme: dark)", color: themeColorByResolvedTheme.dark },
  ],
};

export const themePreferenceLabels: Record<ThemePreference, string> = { light: "Light", dark: "Dark", system: "System" };

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemePreference(cookieValue: string | null | undefined): ThemePreference {
  return isThemePreference(cookieValue) ? cookieValue : "system";
}

export function readHtmlThemeAttribute(preference: ThemePreference): ResolvedTheme | undefined {
  return preference === "system" ? undefined : preference;
}
