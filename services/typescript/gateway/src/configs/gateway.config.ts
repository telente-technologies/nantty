import { defaultRouteLimitsPerMinute, type RouteLimitName } from "../services/routeRateLimitPolicy.service.js";

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
  readonly valkeyUrl?: string | null;
  readonly routeRateLimitsPerMinute?: Readonly<Partial<Record<RouteLimitName, number>>>;
}

export type UpstreamName = "identity" | "live" | "money" | "notifications" | "social" | "trust" | "commerce" | "media" | "search";

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
    maxRequestBodyBytes: Number(readEnvironmentVariableOrDefault("MAX_REQUEST_BODY_BYTES", String(1024 * 1024))),
    valkeyUrl: process.env["VALKEY_URL"]?.trim() || null,
    routeRateLimitsPerMinute: readRouteRateLimits(),
    upstreams: { identity: readRequiredEnvironmentVariable("UPSTREAM_IDENTITY_URL", problems), live: readEnvironmentVariableOrDefault("UPSTREAM_LIVE_URL", "http://localhost:8102"), money: readEnvironmentVariableOrDefault("UPSTREAM_MONEY_URL", "http://localhost:8103"), notifications: readEnvironmentVariableOrDefault("UPSTREAM_NOTIFICATIONS_URL", "http://localhost:8104"), social: readEnvironmentVariableOrDefault("UPSTREAM_SOCIAL_URL", "http://localhost:8105"), trust: readEnvironmentVariableOrDefault("UPSTREAM_TRUST_URL", "http://localhost:8106"), commerce: readEnvironmentVariableOrDefault("UPSTREAM_COMMERCE_URL", "http://localhost:8107"), media: readEnvironmentVariableOrDefault("UPSTREAM_MEDIA_URL", "http://localhost:8108"), search: readEnvironmentVariableOrDefault("UPSTREAM_SEARCH_URL", "http://localhost:8109") },
  };
  if (config.corsOrigins.includes("*")) problems.push("CORS_ORIGINS must list exact origins, not *");
  if (process.env["NODE_ENV"] === "production" && config.valkeyUrl === null) problems.push("VALKEY_URL is required in production");
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (problems.length > 0) throw new Error(`Invalid gateway configuration: ${problems.join("; ")}`);
  return config;
}
