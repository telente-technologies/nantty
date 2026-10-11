import { isAddressInAllowList, isValidAllowListEntry } from "@/utils/ipAllowList.util";

const isProductionRuntime = process.env.NODE_ENV === "production";
const developmentOnlySessionSecret = "zudomart-admin-development-only-secret-never-use-in-production";

export type AdminDeploymentEnvironment = "production" | "staging" | "development";

export function readAdminApiBaseUrl(): string {
  const configuredUrl = process.env.ADMIN_API_URL ?? (isProductionRuntime ? "" : "http://localhost:8080");
  if (!configuredUrl) throw new Error("ADMIN_API_URL is not configured.");
  return configuredUrl.replace(/\/+$/, "");
}

export function isMockBackendEnabled(): boolean {
  const configuredValue = process.env.ADMIN_USE_MOCKS;
  if (configuredValue === undefined || configuredValue === "") return !isProductionRuntime;
  return configuredValue === "true";
}

export function readRealApiPrefixes(): readonly string[] {
  return (process.env.ADMIN_REAL_API_PREFIXES ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/\/+$/, ""))
    .filter((prefix) => prefix.startsWith("/"));
}

export function shouldUseRealBackend(fullPath: string): boolean {
  if (!isMockBackendEnabled()) return true;
  return readRealApiPrefixes().some((prefix) => fullPath === prefix || fullPath.startsWith(`${prefix}/`));
}

export function readSessionSigningSecret(): string {
  const configuredSecret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (configuredSecret.length >= 32) return configuredSecret;
  if (isProductionRuntime) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters in production.");
  return developmentOnlySessionSecret;
}

export function readAdminConsoleOrigin(): string {
  const configuredOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:3400";
  return new URL(configuredOrigin).origin;
}

export function readAdminDeploymentEnvironment(): AdminDeploymentEnvironment {
  const configuredValue = (process.env.ADMIN_ENVIRONMENT ?? "").toLowerCase();
  if (configuredValue === "production" || configuredValue === "staging" || configuredValue === "development") return configuredValue;
  return isProductionRuntime ? "production" : "development";
}

export function readAllowedAdminIpAddresses(): readonly string[] {
  return (process.env.ADMIN_IP_ALLOWLIST ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

export function isProductionDeployment(): boolean {
  return readAdminDeploymentEnvironment() === "production";
}

export function findAdminEnvironmentProblems(): string[] {
  const problems: string[] = [];
  const allowList = readAllowedAdminIpAddresses();
  const invalidEntries = allowList.filter((entry) => !isValidAllowListEntry(entry));
  if (invalidEntries.length > 0) problems.push(`ADMIN_IP_ALLOWLIST has invalid entries: ${invalidEntries.join(", ")}.`);
  if (!isProductionDeployment()) return problems;
  if (allowList.length === 0) problems.push("ADMIN_IP_ALLOWLIST is required in production (comma-separated IPs or IPv4 CIDRs).");
  if ((process.env.ADMIN_SESSION_SECRET ?? "").length < 32) problems.push("ADMIN_SESSION_SECRET must be at least 32 characters in production.");
  if (!process.env.ADMIN_API_URL) problems.push("ADMIN_API_URL is required in production.");
  if (!process.env.ADMIN_ORIGIN) problems.push("ADMIN_ORIGIN is required in production.");
  if (process.env.ADMIN_USE_MOCKS === "true") problems.push("ADMIN_USE_MOCKS must not be true in production.");
  return problems;
}

export function assertAdminEnvironmentIsSafe(): void {
  const problems = findAdminEnvironmentProblems();
  if (problems.length > 0) throw new Error(`Admin console configuration is unsafe:\n- ${problems.join("\n- ")}`);
}

export function isClientAddressAllowedForAdmin(address: string): boolean {
  const allowList = readAllowedAdminIpAddresses();
  if (allowList.length === 0) return !isProductionDeployment();
  return isAddressInAllowList(allowList, address);
}

export function readPrivateMediaOrigin(): string {
  try {
    return process.env.ADMIN_MEDIA_URL ? new URL(process.env.ADMIN_MEDIA_URL).origin : "";
  } catch {
    return "";
  }
}

export function shouldUseSecureHostPrefixedCookies(): boolean {
  return isProductionRuntime || process.env.ADMIN_FORCE_SECURE_COOKIES === "true";
}
