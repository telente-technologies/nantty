/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";

import type { ResolvedTheme, ThemePreference } from "./themePreference.constant";
import { applyThemePreferenceToDocument, readSystemPrefersDark, readThemePreferenceFromDocument, resolveThemePreference, subscribeToThemeChanges, writeThemePreference } from "./themeStorage";

export interface ThemeContextValue {
  readonly preference: ThemePreference;
  readonly resolvedTheme: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
}

export interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly initialPreference?: ThemePreference;
  readonly onPreferenceChange?: (preference: ThemePreference) => void | Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeToNothing(): () => void {
  return () => undefined;
}

export function ThemeProvider({ children, initialPreference = "system", onPreferenceChange }: ThemeProviderProps) {
  const preference = useSyncExternalStore(subscribeToThemeChanges, readThemePreferenceFromDocument, () => initialPreference);
  const systemPrefersDark = useSyncExternalStore(subscribeToThemeChanges, readSystemPrefersDark, () => initialPreference === "dark");
  const isHydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const preferenceChangeHandlerRef = useRef(onPreferenceChange);

  useEffect(() => {
    preferenceChangeHandlerRef.current = onPreferenceChange;
  }, [onPreferenceChange]);

  useEffect(() => {
    if (isHydrated) applyThemePreferenceToDocument(preference);
  }, [isHydrated, preference, systemPrefersDark]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    writeThemePreference(nextPreference);
    const handler = preferenceChangeHandlerRef.current;
    if (handler) void Promise.resolve(handler(nextPreference)).catch(() => undefined);
  }, []);

  const contextValue = useMemo<ThemeContextValue>(() => ({ preference, resolvedTheme: resolveThemePreference(preference, systemPrefersDark), setPreference }), [preference, systemPrefersDark, setPreference]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const contextValue = useContext(ThemeContext);
  if (!contextValue) throw new Error("useTheme must be used inside ThemeProvider");
  return contextValue;
}
