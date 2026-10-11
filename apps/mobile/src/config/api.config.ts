import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; useMocks?: boolean; realApiPrefixes?: string };

export const parseRealApiPrefixes = (value: string | undefined): readonly string[] =>
  (value ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/\/+$/, ""))
    .filter((prefix) => prefix.startsWith("/"));

export const matchesRealApiPrefix = (path: string, prefixes: readonly string[]) => {
  const pathname = path.split("?")[0] ?? path;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

export const apiConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:8080",
  useMocks: (process.env.EXPO_PUBLIC_USE_MOCKS ?? String(extra.useMocks ?? __DEV__)) === "true",
  realApiPrefixes: parseRealApiPrefixes(process.env.EXPO_PUBLIC_REAL_API_PREFIXES ?? extra.realApiPrefixes),
  timeoutMs: 15_000,
};

export const shouldUseMockForPath = (path: string) => apiConfig.useMocks && !matchesRealApiPrefix(path, apiConfig.realApiPrefixes);
