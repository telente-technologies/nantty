const isProductionRuntime = process.env.NODE_ENV === "production";
const developmentOnlySessionSecret = "zudomart-dashboard-development-only-secret-never-use-in-production";

export function readSellerApiBaseUrl(): string {
  const configuredUrl = process.env.SELLER_API_URL ?? (isProductionRuntime ? "" : "http://localhost:3000");
  if (!configuredUrl) throw new Error("SELLER_API_URL is not configured.");
  return configuredUrl.replace(/\/+$/, "");
}

export function isMockBackendEnabled(): boolean {
  const configuredValue = process.env.SELLER_USE_MOCKS;
  if (configuredValue === undefined || configuredValue === "") return !isProductionRuntime;
  return configuredValue === "true";
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
