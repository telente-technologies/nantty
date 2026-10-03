declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_USE_MOCKS?: string;
    readonly EXPO_PUBLIC_REAL_API_PREFIXES?: string;
  }
}
