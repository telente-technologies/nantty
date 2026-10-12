const productionSessionSecretPattern = /^[0-9a-f]{64}$/i;
const sessionSecretPlaceholder = "replace-with-64-random-hex-characters";
const isProductionRuntime = process.env.NODE_ENV === "production";
const developmentOnlySessionSecret = "zudomart-studio-development-only-secret-never-use-in-production";

export function readStudioApiBaseUrl(): string {
  const configuredUrl = process.env.STUDIO_API_URL ?? (isProductionRuntime ? "" : "http://localhost:8080");
  if (!configuredUrl) throw new Error("STUDIO_API_URL is not configured.");
  return configuredUrl.replace(/\/+$/, "");
}

export function readRealtimeSocketUrl(): string {
  const configured = process.env.STUDIO_REALTIME_URL?.trim() || `${readStudioApiBaseUrl()}/ws`;
  return configured.replace(/^http(s?):\/\//i, (_, secure: string) => (secure ? "wss://" : "ws://"));
}

export function isMockBackendEnabled(): boolean {
  if (isProductionRuntime) return false;
  const configuredValue = process.env.STUDIO_USE_MOCKS;
  if (configuredValue === undefined || configuredValue === "") return true;
  return configuredValue === "true";
}

export function readRealApiPrefixes(): readonly string[] {
  return (process.env.STUDIO_REAL_API_PREFIXES ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/\/+$/, ""))
    .filter((prefix) => prefix.startsWith("/"));
}

export function shouldUseRealBackend(fullPath: string): boolean {
  if (!isMockBackendEnabled()) return true;
  return readRealApiPrefixes().some((prefix) => fullPath === prefix || fullPath.startsWith(`${prefix}/`));
}

export function readSessionSigningSecret(): string {
  const configuredSecret = process.env.STUDIO_SESSION_SECRET ?? "";
  if (isProductionRuntime) {
    if (configuredSecret === sessionSecretPlaceholder || !productionSessionSecretPattern.test(configuredSecret)) {
      throw new Error("STUDIO_SESSION_SECRET must be exactly 64 hex characters in production.");
    }
    return configuredSecret;
  }
  if (configuredSecret.length >= 32 && configuredSecret !== sessionSecretPlaceholder) return configuredSecret;
  return developmentOnlySessionSecret;
}

export function readStudioOrigin(): string {
  const configuredOrigin = process.env.STUDIO_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3600";
  return new URL(configuredOrigin).origin;
}

export function readPublicSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3600";
}

export function shouldUseSecureHostPrefixedCookies(): boolean {
  return isProductionRuntime;
}
