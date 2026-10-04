export interface InternalSource {
  readonly baseUrl: string;
  readonly internalToken: string;
}

export interface SupportConfig {
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly databaseSchema: string;
  readonly internalToken: string;
  readonly webBaseUrl: string;
  readonly mediaPublicBaseUrls: readonly string[];
  readonly staffAuth: { readonly jwksUrl: string; readonly issuer: string } | undefined;
  readonly rabbitMq: { readonly url: string; readonly prefetch: number } | undefined;
  readonly consumersEnabled: boolean;
  readonly domainEventsQueue: string;
  readonly jobsEnabled: boolean;
  readonly seedHelpContent: boolean;
  readonly identity: InternalSource | undefined;
  readonly intelligence: { readonly baseUrl: string; readonly sharedSecret: string; readonly timeoutMs: number } | undefined;
}

function readOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? fallback : value;
}

export function loadSupportConfigFromEnvironment(): SupportConfig {
  const problems: string[] = [];
  const databaseUrl = readOrDefault("DATABASE_URL", "");
  if (databaseUrl === "") problems.push("DATABASE_URL is required");
  const internalToken = readOrDefault("SUPPORT_INTERNAL_TOKEN", "");
  if (internalToken.length < 24) problems.push("SUPPORT_INTERNAL_TOKEN must be at least 24 characters");
  const jwksUrl = readOrDefault("AUTH_JWKS_URL", "");
  const identityUrl = readOrDefault("IDENTITY_INTERNAL_URL", "");
  const intelligenceUrl = readOrDefault("INTELLIGENCE_URL", "");
  const rabbitUrl = readOrDefault("RABBITMQ_URL", "");
  const config: SupportConfig = {
    host: readOrDefault("HOST", "0.0.0.0"),
    port: Number(readOrDefault("PORT", "8111")),
    databaseUrl,
    databaseSchema: readOrDefault("DATABASE_SCHEMA", "support"),
    internalToken,
    webBaseUrl: readOrDefault("WEB_BASE_URL", "https://zudomart.com").replace(/\/+$/, ""),
    mediaPublicBaseUrls: readOrDefault("MEDIA_PUBLIC_BASE_URL", "").split(",").map((entry) => entry.trim().replace(/\/+$/, "")).filter(Boolean),
    staffAuth: jwksUrl === "" ? undefined : { jwksUrl, issuer: readOrDefault("AUTH_TOKEN_ISSUER", "") },
    rabbitMq: rabbitUrl === "" ? undefined : { url: rabbitUrl, prefetch: Number(readOrDefault("RABBITMQ_PREFETCH", "20")) },
    consumersEnabled: readOrDefault("CONSUMERS_ENABLED", "true") === "true",
    domainEventsQueue: readOrDefault("SUPPORT_DOMAIN_EVENTS_QUEUE", "support-domain-events"),
    jobsEnabled: readOrDefault("JOBS_ENABLED", "true") === "true",
    seedHelpContent: readOrDefault("SEED_HELP_CONTENT", "true") === "true",
    identity: identityUrl === "" ? undefined : { baseUrl: identityUrl, internalToken: readOrDefault("IDENTITY_INTERNAL_TOKEN", "") },
    intelligence: intelligenceUrl === "" ? undefined : { baseUrl: intelligenceUrl, sharedSecret: readOrDefault("INTELLIGENCE_SHARED_SECRET", ""), timeoutMs: Number(readOrDefault("INTELLIGENCE_TIMEOUT_MS", "3000")) },
  };
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (config.staffAuth !== undefined && config.staffAuth.issuer === "") problems.push("AUTH_TOKEN_ISSUER is required when AUTH_JWKS_URL is set");
  if (config.intelligence !== undefined && config.intelligence.sharedSecret === "") problems.push("INTELLIGENCE_SHARED_SECRET is required when INTELLIGENCE_URL is set");
  if (process.env["NODE_ENV"] === "production" && config.staffAuth === undefined) problems.push("AUTH_JWKS_URL is required in production");
  if (problems.length > 0) throw new Error(`Invalid support configuration: ${problems.join("; ")}`);
  return config;
}
