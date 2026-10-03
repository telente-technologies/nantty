import { darkColorSchemeQuery, parseThemePreference, themeChangedEventName, themeColorByResolvedTheme, themeCookieMaxAgeSeconds, themeCookieName, type ResolvedTheme, type ThemePreference } from "./themePreference.constant";

export function readThemePreferenceFromDocument(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const entry = document.cookie.split("; ").find((cookiePart) => cookiePart.startsWith(`${themeCookieName}=`));
  return parseThemePreference(entry?.slice(themeCookieName.length + 1));
}

export function readSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(darkColorSchemeQuery).matches;
}

export function resolveThemePreference(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function applyThemePreferenceToDocument(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
  const resolvedTheme = resolveThemePreference(preference, readSystemPrefersDark());
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((metaElement) => {
    metaElement.content = themeColorByResolvedTheme[resolvedTheme];
  });
}

export function writeThemePreference(preference: ThemePreference): void {
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${themeCookieName}=${preference}; Path=/; Max-Age=${themeCookieMaxAgeSeconds}; SameSite=Lax${secureFlag}`;
  applyThemePreferenceToDocument(preference);
  window.dispatchEvent(new Event(themeChangedEventName));
}

export function subscribeToThemeChanges(onChange: () => void): () => void {
  const systemQuery = window.matchMedia(darkColorSchemeQuery);
  window.addEventListener(themeChangedEventName, onChange);
  systemQuery.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(themeChangedEventName, onChange);
    systemQuery.removeEventListener("change", onChange);
  };
}
