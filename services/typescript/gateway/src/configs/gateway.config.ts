export interface GatewayConfig {
  readonly host: string;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly rateLimitMaxPerMinute: number;
  readonly upstreamTimeoutMs: number;
  readonly guestRateLimits: { readonly perMinute: number; readonly sensitivePerMinute: number };
  readonly accessToken: { readonly jwksUrl: string; readonly issuer: string; readonly audience: string };
  readonly upstreams: Readonly<Record<UpstreamName, string>>;
}

export type UpstreamName = "identity" | "live" | "money" | "notifications" | "social" | "trust" | "commerce";

function readRequiredEnvironmentVariable(name: string, problems: string[]): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") problems.push(`${name} is required`);
  return value;
}

function readEnvironmentVariableOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? fallback : value;
}

export function loadGatewayConfigFromEnvironment(): GatewayConfig {
  const problems: string[] = [];
  const config: GatewayConfig = {
    host: readEnvironmentVariableOrDefault("HOST", "0.0.0.0"),
    port: Number(readEnvironmentVariableOrDefault("PORT", "8080")),
    corsOrigins: readEnvironmentVariableOrDefault("CORS_ORIGINS", "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean),
    rateLimitMaxPerMinute: Number(readEnvironmentVariableOrDefault("RATE_LIMIT_MAX_PER_MINUTE", "600")),
    guestRateLimits: { perMinute: Number(readEnvironmentVariableOrDefault("GUEST_RATE_LIMIT_PER_MINUTE", "120")), sensitivePerMinute: Number(readEnvironmentVariableOrDefault("GUEST_SENSITIVE_RATE_LIMIT_PER_MINUTE", "30")) },
    upstreamTimeoutMs: Number(readEnvironmentVariableOrDefault("UPSTREAM_TIMEOUT_MS", "10000")),
    accessToken: {
      jwksUrl: readRequiredEnvironmentVariable("AUTH_JWKS_URL", problems),
      issuer: readRequiredEnvironmentVariable("AUTH_TOKEN_ISSUER", problems),
      audience: readEnvironmentVariableOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
    },
    upstreams: { identity: readRequiredEnvironmentVariable("UPSTREAM_IDENTITY_URL", problems), live: readEnvironmentVariableOrDefault("UPSTREAM_LIVE_URL", "http://localhost:8102"), money: readEnvironmentVariableOrDefault("UPSTREAM_MONEY_URL", "http://localhost:8103"), notifications: readEnvironmentVariableOrDefault("UPSTREAM_NOTIFICATIONS_URL", "http://localhost:8104"), social: readEnvironmentVariableOrDefault("UPSTREAM_SOCIAL_URL", "http://localhost:8105"), trust: readEnvironmentVariableOrDefault("UPSTREAM_TRUST_URL", "http://localhost:8106"), commerce: readEnvironmentVariableOrDefault("UPSTREAM_COMMERCE_URL", "http://localhost:8107") },
  };
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (problems.length > 0) throw new Error(`Invalid gateway configuration: ${problems.join("; ")}`);
  return config;
}
