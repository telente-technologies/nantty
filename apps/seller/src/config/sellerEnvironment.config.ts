const isProductionRuntime = process.env.NODE_ENV === "production";
const developmentOnlySessionSecret = "nantty-dashboard-development-only-secret-never-use-in-production";

export function readSellerApiBaseUrl(): string {
  const configuredUrl = process.env.SELLER_API_URL ?? (isProductionRuntime ? "" : "http://localhost:8080");
  if (!configuredUrl) throw new Error("SELLER_API_URL is not configured.");
  return configuredUrl.replace(/\/+$/, "");
}

export function readRealtimeSocketUrl(): string {
  const configured = process.env.SELLER_REALTIME_URL ?? `${readSellerApiBaseUrl()}/ws`;
  return configured.replace(/^http(s?):\/\//i, (_, secure: string) => (secure ? "wss://" : "ws://"));
}

export function isMockBackendEnabled(): boolean {
  if (isProductionRuntime) return false;
  const configuredValue = process.env.SELLER_USE_MOCKS;
  if (configuredValue === undefined || configuredValue === "") return true;
  return configuredValue === "true";
}

export function readRealApiPrefixes(): readonly string[] {
  return (process.env.SELLER_REAL_API_PREFIXES ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/\/+$/, ""))
    .filter((prefix) => prefix.startsWith("/"));
}

export function shouldUseRealBackend(fullPath: string): boolean {
  if (!isMockBackendEnabled()) return true;
  return readRealApiPrefixes().some((prefix) => fullPath === prefix || fullPath.startsWith(`${prefix}/`));
}

export function readSessionSigningSecret(): string {
  const configuredSecret = process.env.SELLER_SESSION_SECRET ?? "";
  if (configuredSecret.length >= 32) return configuredSecret;
  if (isProductionRuntime) throw new Error("SELLER_SESSION_SECRET must be at least 32 characters in production.");
  return developmentOnlySessionSecret;
}

export function readDashboardOrigin(): string {
  const configuredOrigin = process.env.DASHBOARD_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
  return new URL(configuredOrigin).origin;
}

export function shouldUseSecureHostPrefixedCookies(): boolean {
  return isProductionRuntime;
}
