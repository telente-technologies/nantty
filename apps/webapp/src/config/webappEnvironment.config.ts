const isProductionRuntime = process.env.NODE_ENV === "production";
const developmentOnlySessionSecret = "zudomart-webapp-development-only-secret-never-use-in-production";

export function readWebappApiBaseUrl(): string {
  const configuredUrl = process.env.WEBAPP_API_URL ?? (isProductionRuntime ? "" : "http://localhost:3000");
  if (!configuredUrl) throw new Error("WEBAPP_API_URL is not configured.");
  return configuredUrl.replace(/\/+$/, "");
}

export function isMockBackendEnabled(): boolean {
  const configuredValue = process.env.WEBAPP_USE_MOCKS;
  if (configuredValue === undefined || configuredValue === "") return !isProductionRuntime;
  return configuredValue === "true";
}

export function readSessionSigningSecret(): string {
  const configuredSecret = process.env.WEBAPP_SESSION_SECRET ?? "";
  if (configuredSecret.length >= 32) return configuredSecret;
  if (isProductionRuntime) throw new Error("WEBAPP_SESSION_SECRET must be at least 32 characters in production.");
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
