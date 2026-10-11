const productionSessionSecretPattern = /^[0-9a-f]{64}$/i;
const sessionSecretPlaceholder = "replace-with-64-random-hex-characters";
const isProductionRuntime = process.env.NODE_ENV === "production";
const developmentOnlySessionSecret = "zudomart-webapp-development-only-secret-never-use-in-production";

export function readWebappApiBaseUrl(): string {
  const configuredUrl = process.env.WEBAPP_API_URL ?? (isProductionRuntime ? "" : "http://localhost:8080");
  if (!configuredUrl) throw new Error("WEBAPP_API_URL is not configured.");
  return configuredUrl.replace(/\/+$/, "");
}

export function isMockBackendEnabled(): boolean {
  if (isProductionRuntime) return false;
  const configuredValue = process.env.WEBAPP_USE_MOCKS;
  if (configuredValue === undefined || configuredValue === "") return true;
  return configuredValue === "true";
}

export function readRealApiPrefixes(): readonly string[] {
  return (process.env.WEBAPP_REAL_API_PREFIXES ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/\/+$/, ""))
    .filter((prefix) => prefix.startsWith("/"));
}

export function shouldUseRealBackend(fullPath: string): boolean {
  if (!isMockBackendEnabled()) return true;
  return readRealApiPrefixes().some((prefix) => fullPath === prefix || fullPath.startsWith(`${prefix}/`));
}

export function readSessionSigningSecret(): string {
  const configuredSecret = process.env.WEBAPP_SESSION_SECRET ?? "";
  if (isProductionRuntime) {
    if (configuredSecret === sessionSecretPlaceholder || !productionSessionSecretPattern.test(configuredSecret)) {
      throw new Error("WEBAPP_SESSION_SECRET must be exactly 64 hex characters in production.");
    }
    return configuredSecret;
  }
  if (configuredSecret.length >= 32 && configuredSecret !== sessionSecretPlaceholder) return configuredSecret;
  return developmentOnlySessionSecret;
}

export function readWebappOrigin(): string {
  const configuredOrigin = process.env.WEBAPP_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3500";
  return new URL(configuredOrigin).origin;
}

export function readPublicSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3500";
}

export function shouldUseSecureHostPrefixedCookies(): boolean {
  return isProductionRuntime;
}
