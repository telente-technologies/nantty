import { readGatewayIdentitySecretsFromEnvironment } from "../middlewares/gatewayIdentity.middleware.js";

export interface InternalSource {
  readonly baseUrl: string;
  readonly internalToken: string;
}

export interface SearchConfig {
  readonly gatewayIdentitySecrets?: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly internalToken: string;
  readonly consumersEnabled: boolean;
  readonly domainEventsQueue: string;
  readonly rabbitMq: { readonly url: string; readonly prefetch: number } | undefined;
  readonly databaseSchema: string;
  readonly identity: InternalSource | undefined;
  readonly commerce: InternalSource | undefined;
  readonly social: InternalSource | undefined;
  readonly intelligence: { readonly baseUrl: string; readonly sharedSecret: string; readonly timeoutMs: number } | undefined;
}

function readOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? fallback : value;
}

function readInternalSource(prefix: string): InternalSource | undefined {
  const baseUrl = process.env[`${prefix}_URL`]?.trim() ?? "";
  return baseUrl === "" ? undefined : { baseUrl, internalToken: process.env[`${prefix}_TOKEN`]?.trim() ?? "" };
}

export function loadSearchConfigFromEnvironment(): SearchConfig {
  const problems: string[] = [];
  const databaseUrl = readOrDefault("DATABASE_URL", "");
  if (databaseUrl === "") problems.push("DATABASE_URL is required");
  const internalToken = readOrDefault("SEARCH_INTERNAL_TOKEN", "");
  if (internalToken === "") problems.push("SEARCH_INTERNAL_TOKEN is required");
  const intelligenceUrl = readOrDefault("INTELLIGENCE_URL", "");
  const config: SearchConfig = {
    gatewayIdentitySecrets: readGatewayIdentitySecretsFromEnvironment(problems),
    host: readOrDefault("HOST", "0.0.0.0"),
    port: Number(readOrDefault("PORT", "8109")),
    databaseUrl,
    internalToken,
    consumersEnabled: readOrDefault("CONSUMERS_ENABLED", "true") === "true",
    domainEventsQueue: readOrDefault("SEARCH_DOMAIN_EVENTS_QUEUE", "search-domain-events"),
    rabbitMq: readOrDefault("RABBITMQ_URL", "") === "" ? undefined : { url: readOrDefault("RABBITMQ_URL", ""), prefetch: Number(readOrDefault("RABBITMQ_PREFETCH", "20")) },
    databaseSchema: readOrDefault("DATABASE_SCHEMA", "search"),
    identity: readInternalSource("IDENTITY_INTERNAL"),
    commerce: readInternalSource("COMMERCE_INTERNAL"),
    social: readInternalSource("SOCIAL_INTERNAL"),
    intelligence: intelligenceUrl === "" ? undefined : { baseUrl: intelligenceUrl, sharedSecret: readOrDefault("INTELLIGENCE_SHARED_SECRET", ""), timeoutMs: Number(readOrDefault("RERANK_TIMEOUT_MS", "100")) },
  };
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (config.intelligence !== undefined && config.intelligence.sharedSecret === "") problems.push("INTELLIGENCE_SHARED_SECRET is required when INTELLIGENCE_URL is set");
  if (problems.length > 0) throw new Error(`Invalid search configuration: ${problems.join("; ")}`);
  return config;
}
