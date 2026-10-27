const isProductionRuntime = process.env.NODE_ENV === "production";
const developmentOnlySessionSecret = "nantty-ads-manager-development-only-secret-never-use-in-production";
const defaultHostedCheckoutHosts = ["checkout.flutterwave.com", "checkout-testing.flutterwave.com"];

export function readAdsApiBaseUrl(): string {
  const configuredUrl = process.env.ADS_API_URL ?? (isProductionRuntime ? "" : "http://localhost:8080");
  if (!configuredUrl) throw new Error("ADS_API_URL is not configured.");
  return configuredUrl.replace(/\/+$/, "");
}

export function isMockBackendEnabled(): boolean {
  if (isProductionRuntime) return false;
  const configuredValue = process.env.ADS_USE_MOCKS;
  if (configuredValue === undefined || configuredValue === "") return true;
  return configuredValue === "true";
}

export function readRealApiPrefixes(): readonly string[] {
  return (process.env.ADS_REAL_API_PREFIXES ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/\/+$/, ""))
    .filter((prefix) => prefix.startsWith("/"));
}

export function shouldUseRealBackend(fullPath: string): boolean {
  if (!isMockBackendEnabled()) return true;
  return readRealApiPrefixes().some((prefix) => fullPath === prefix || fullPath.startsWith(`${prefix}/`));
}

export function readSessionSigningSecret(): string {
  const configuredSecret = process.env.ADS_SESSION_SECRET ?? "";
  if (configuredSecret.length >= 32) return configuredSecret;
  if (isProductionRuntime) throw new Error("ADS_SESSION_SECRET must be at least 32 characters in production.");
  return developmentOnlySessionSecret;
}

export function readAdsManagerOrigin(): string {
  const configuredOrigin = process.env.ADS_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";
  return new URL(configuredOrigin).origin;
}

export function readAllowedHostedCheckoutHosts(): readonly string[] {
  const configuredHosts = (process.env.ADS_CHECKOUT_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return configuredHosts.length > 0 ? configuredHosts : defaultHostedCheckoutHosts;
}

export function shouldUseSecureHostPrefixedCookies(): boolean {
  return isProductionRuntime;
}
