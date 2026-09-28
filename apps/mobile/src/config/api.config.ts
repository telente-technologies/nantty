import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; useMocks?: boolean };

export const apiConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:3000",
  useMocks: (process.env.EXPO_PUBLIC_USE_MOCKS ?? String(extra.useMocks ?? true)) === "true",
  timeoutMs: 15_000,
};
