import { defaultRouteLimitsPerMinute, type RouteLimitName } from "../services/routeRateLimitPolicy.service.js";
import { isValidAllowListEntry } from "../middlewares/adminNetwork.middleware.js";
import { loadSecurityConfigFromEnvironment, type SecurityConfig } from "./security.config.js";
import { collectProductionHardeningProblems } from "./productionHardening.config.js";

export interface GatewayConfig {
  readonly host: string;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly rateLimitMaxPerMinute: number;
  readonly upstreamTimeoutMs: number;
  readonly policyGate: { readonly internalToken: string } | null;
  readonly guestRateLimits: { readonly perMinute: number; readonly sensitivePerMinute: number };
  readonly accessToken: { readonly jwksUrl: string; readonly issuer: string; readonly audience: string };
  readonly upstreams: Readonly<Record<UpstreamName, string>>;
  readonly maxRequestBodyBytes?: number;
  readonly trustedProxyHops?: number;
  readonly trustCdnCountryHeader?: boolean;
  readonly valkeyUrl?: string | null;
  readonly sessionDenylistUrl?: string | null;
  readonly routeRateLimitsPerMinute?: Readonly<Partial<Record<RouteLimitName, number>>>;
  readonly security?: SecurityConfig | null;
  readonly identitySigningSecret?: string;
  readonly adminIpAllowList?: readonly string[];
}

export type UpstreamName = "identity" | "live" | "money" | "notifications" | "social" | "trust" | "commerce" | "media" | "search" | "ads" | "support";

function readRequiredEnvironmentVariable(name: string, problems: string[]): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") problems.push(`${name} is required`);
  return value;
}

function readEnvironmentVariableOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? fallback : value;
}

const appOriginVariables = ["CORS_ORIGIN_WEB", "CORS_ORIGIN_WEBAPP", "CORS_ORIGIN_SELLER", "CORS_ORIGIN_STUDIO", "CORS_ORIGIN_ADMIN", "CORS_ORIGIN_ADS", "CORS_ORIGIN_GIFT"] as const;

function readAllowedCorsOrigins(): string[] {
  const listed = readEnvironmentVariableOrDefault("CORS_ORIGINS", "http://localhost:3000").split(",");
  const perApp = appOriginVariables.map((name) => process.env[name] ?? "");
  return [...new Set([...listed, ...perApp].map((origin) => origin.trim()).filter(Boolean))];
}

function readRouteRateLimits(): Partial<Record<RouteLimitName, number>> {
  const limits: Partial<Record<RouteLimitName, number>> = {};
  for (const name of Object.keys(defaultRouteLimitsPerMinute) as RouteLimitName[]) {
    limits[name] = Number(readEnvironmentVariableOrDefault(`RATE_LIMIT_${name.toUpperCase()}_PER_MINUTE`, String(defaultRouteLimitsPerMinute[name])));
  }
  return limits;
}

export function loadGatewayConfigFromEnvironment(): GatewayConfig {
  const problems: string[] = [];
  const config: GatewayConfig = {
    host: readEnvironmentVariableOrDefault("HOST", "0.0.0.0"),
    port: Number(readEnvironmentVariableOrDefault("PORT", "8080")),
    corsOrigins: readAllowedCorsOrigins(),
    rateLimitMaxPerMinute: Number(readEnvironmentVariableOrDefault("RATE_LIMIT_MAX_PER_MINUTE", "600")),
    guestRateLimits: { perMinute: Number(readEnvironmentVariableOrDefault("GUEST_RATE_LIMIT_PER_MINUTE", "120")), sensitivePerMinute: Number(readEnvironmentVariableOrDefault("GUEST_SENSITIVE_RATE_LIMIT_PER_MINUTE", "30")) },
    policyGate: process.env["IDENTITY_INTERNAL_TOKEN"]?.trim() ? { internalToken: process.env["IDENTITY_INTERNAL_TOKEN"].trim() } : null,
    upstreamTimeoutMs: Number(readEnvironmentVariableOrDefault("UPSTREAM_TIMEOUT_MS", "10000")),
    accessToken: {
      jwksUrl: readRequiredEnvironmentVariable("AUTH_JWKS_URL", problems),
      issuer: readRequiredEnvironmentVariable("AUTH_TOKEN_ISSUER", problems),
      audience: readEnvironmentVariableOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
    },
    trustedProxyHops: Number(readEnvironmentVariableOrDefault("TRUSTED_PROXY_HOPS", "0")),
    trustCdnCountryHeader: readEnvironmentVariableOrDefault("TRUST_CDN_COUNTRY_HEADER", "false") === "true",
    maxRequestBodyBytes: Number(readEnvironmentVariableOrDefault("MAX_REQUEST_BODY_BYTES", String(1024 * 1024))),
    valkeyUrl: process.env["VALKEY_URL"]?.trim() || null,
    sessionDenylistUrl: process.env["AUTH_SESSION_DENYLIST_URL"]?.trim() || null,
    routeRateLimitsPerMinute: readRouteRateLimits(),
    security: loadSecurityConfigFromEnvironment(problems),
    identitySigningSecret: readRequiredEnvironmentVariable("GATEWAY_IDENTITY_SECRET", problems),
    adminIpAllowList: readEnvironmentVariableOrDefault("ADMIN_IP_ALLOWLIST", "").split(",").map((entry) => entry.trim()).filter(Boolean),
    upstreams: { identity: readRequiredEnvironmentVariable("UPSTREAM_IDENTITY_URL", problems), live: readEnvironmentVariableOrDefault("UPSTREAM_LIVE_URL", "http://localhost:8102"), money: readEnvironmentVariableOrDefault("UPSTREAM_MONEY_URL", "http://localhost:8103"), notifications: readEnvironmentVariableOrDefault("UPSTREAM_NOTIFICATIONS_URL", "http://localhost:8104"), social: readEnvironmentVariableOrDefault("UPSTREAM_SOCIAL_URL", "http://localhost:8105"), trust: readEnvironmentVariableOrDefault("UPSTREAM_TRUST_URL", "http://localhost:8106"), commerce: readEnvironmentVariableOrDefault("UPSTREAM_COMMERCE_URL", "http://localhost:8107"), media: readEnvironmentVariableOrDefault("UPSTREAM_MEDIA_URL", "http://localhost:8108"), search: readEnvironmentVariableOrDefault("UPSTREAM_SEARCH_URL", "http://localhost:8109"), ads: readEnvironmentVariableOrDefault("UPSTREAM_ADS_URL", "http://localhost:8110"), support: readEnvironmentVariableOrDefault("UPSTREAM_SUPPORT_URL", "http://localhost:8111") },
  };
  if (config.corsOrigins.includes("*")) problems.push("CORS_ORIGINS must list exact origins, not *");
  if (process.env["NODE_ENV"] === "production" && config.valkeyUrl === null) problems.push("VALKEY_URL is required in production");
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if ((config.identitySigningSecret ?? "").length > 0 && (config.identitySigningSecret ?? "").length < 32) problems.push("GATEWAY_IDENTITY_SECRET must be at least 32 characters");
  if (!Number.isInteger(config.trustedProxyHops) || (config.trustedProxyHops ?? 0) < 0) problems.push("TRUSTED_PROXY_HOPS must be a non-negative integer");
  if ((config.adminIpAllowList ?? []).some((entry) => !isValidAllowListEntry(entry))) problems.push("ADMIN_IP_ALLOWLIST must list IP addresses or CIDR ranges");
  problems.push(...collectProductionHardeningProblems(process.env));
  if (problems.length > 0) throw new Error(`Invalid gateway configuration: ${problems.join("; ")}`);
  return config;
}
