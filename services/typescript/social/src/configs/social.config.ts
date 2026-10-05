import { readGatewayIdentitySecretsFromEnvironment } from "../middlewares/gatewayIdentity.middleware.js";

export interface SocialConfig {
  readonly gatewayIdentitySecrets?: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly identityReadDatabaseUrl: string;
  readonly messageBus: "rabbitmq" | "sqs";
  readonly rabbitMqUrl: string;
  readonly domainEventsTopicArn: string;
  readonly awsRegion: string;
  readonly awsEndpointUrl: string | undefined;
  readonly outboxPollIntervalMs: number;
  readonly mediaExpiryIntervalMs: number;
  readonly jobsEnabled: boolean;
  readonly domainEventsQueue: string;
  readonly rabbitMqPrefetch: number;
  readonly mediaPublicBaseUrl: string;
  readonly commerceInternal: { readonly baseUrl: string; readonly internalToken: string } | undefined;
  readonly liveInternal: { readonly baseUrl: string; readonly internalToken: string } | undefined;
  readonly adsInternal?: { readonly baseUrl: string; readonly sharedSecret: string } | undefined;
  readonly mediaInternal?: { readonly baseUrl: string; readonly internalToken: string } | undefined;
  readonly linkPreviewsEnabled: boolean;
  readonly linkPreviewMediaOwnerId: string;
  readonly moneyInternal: { readonly baseUrl: string; readonly internalToken: string } | undefined;
  readonly adminInternal?: { readonly baseUrl: string; readonly internalToken: string } | undefined;
  readonly intelligence?: { readonly baseUrl: string; readonly sharedSecret: string; readonly idHashSecret?: string; readonly feedRankTimeoutMs: number; readonly exploreTimeoutMs: number } | undefined;
}

function readRequired(name: string, problems: string[]): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") problems.push(`${name} is required`);
  return value;
}

function readOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? fallback : value;
}

function readInternalSource(prefix: string): { readonly baseUrl: string; readonly internalToken: string } | undefined {
  const baseUrl = process.env[`${prefix}_URL`]?.trim() ?? "";
  return baseUrl === "" ? undefined : { baseUrl, internalToken: process.env[`${prefix}_TOKEN`]?.trim() ?? "" };
}

function readAdsInternal(): SocialConfig["adsInternal"] {
  const baseUrl = readOrDefault("ADS_INTERNAL_URL", "");
  const sharedSecret = readOrDefault("ADS_INTERNAL_SHARED_SECRET", "");
  return baseUrl === "" || sharedSecret === "" ? undefined : { baseUrl, sharedSecret };
}

function readAdminInternalSource(): SocialConfig["adminInternal"] {
  const source = readInternalSource("ADMIN_INTERNAL");
  return source === undefined ? undefined : { ...source, internalToken: source.internalToken || readOrDefault("ADMIN_INTERNAL_API_TOKEN", "") };
}

function readIntelligence(problems: string[]): SocialConfig["intelligence"] {
  const baseUrl = readOrDefault("INTELLIGENCE_URL", "");
  if (baseUrl === "") return undefined;
  const sharedSecret = readOrDefault("INTELLIGENCE_SHARED_SECRET", "");
  if (sharedSecret === "") problems.push("INTELLIGENCE_SHARED_SECRET is required when INTELLIGENCE_URL is set");
  return { baseUrl, sharedSecret, idHashSecret: readOrDefault("INTELLIGENCE_ID_HASH_SECRET", ""), feedRankTimeoutMs: Number(readOrDefault("FEED_RANK_TIMEOUT_MS", "250")), exploreTimeoutMs: Number(readOrDefault("EXPLORE_INTELLIGENCE_TIMEOUT_MS", "400")) };
}

export function loadSocialConfigFromEnvironment(): SocialConfig {
  const problems: string[] = [];
  const databaseUrl = readRequired("DATABASE_URL", problems);
  const config: SocialConfig = {
    gatewayIdentitySecrets: readGatewayIdentitySecretsFromEnvironment(problems),
    host: readOrDefault("HOST", "0.0.0.0"),
    port: Number(readOrDefault("PORT", "8105")),
    databaseUrl,
    identityReadDatabaseUrl: readOrDefault("IDENTITY_READ_DATABASE_URL", databaseUrl),
    messageBus: readOrDefault("EVENT_BUS", "rabbitmq") === "sqs" ? "sqs" : "rabbitmq",
    rabbitMqUrl: readOrDefault("RABBITMQ_URL", ""),
    domainEventsTopicArn: readOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
    awsRegion: readOrDefault("AWS_REGION", "eu-west-1"),
    awsEndpointUrl: process.env["AWS_ENDPOINT_URL"]?.trim() || undefined,
    outboxPollIntervalMs: Number(readOrDefault("OUTBOX_POLL_INTERVAL_MS", "500")),
    mediaExpiryIntervalMs: Number(readOrDefault("MEDIA_EXPIRY_INTERVAL_MS", String(60 * 60 * 1000))),
    jobsEnabled: readOrDefault("JOBS_ENABLED", "true") === "true",
    domainEventsQueue: readOrDefault("SOCIAL_DOMAIN_EVENTS_QUEUE", "social-domain-events"),
    rabbitMqPrefetch: Number(readOrDefault("RABBITMQ_PREFETCH", "20")),
    mediaPublicBaseUrl: readOrDefault("MEDIA_PUBLIC_BASE_URL", ""),
    commerceInternal: readInternalSource("COMMERCE_INTERNAL"),
    liveInternal: readInternalSource("LIVE_INTERNAL"),
    linkPreviewsEnabled: readOrDefault("LINK_PREVIEWS_ENABLED", "true") === "true",
    linkPreviewMediaOwnerId: readOrDefault("LINK_PREVIEW_MEDIA_OWNER_ID", "00000000-0000-7000-8000-00000000c0de"),
    moneyInternal: readInternalSource("MONEY_INTERNAL"),
    mediaInternal: readInternalSource("MEDIA_INTERNAL"),
    adsInternal: readAdsInternal(),
    adminInternal: readAdminInternalSource(),
    intelligence: readIntelligence(problems),
  };
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (problems.length > 0) throw new Error(`Invalid social configuration: ${problems.join("; ")}`);
  return config;
}
