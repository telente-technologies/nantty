export interface SocialConfig {
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly identityReadDatabaseUrl: string;
  readonly domainEventsTopicArn: string;
  readonly awsRegion: string;
  readonly awsEndpointUrl: string | undefined;
  readonly outboxPollIntervalMs: number;
  readonly mediaExpiryIntervalMs: number;
  readonly jobsEnabled: boolean;
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

export function loadSocialConfigFromEnvironment(): SocialConfig {
  const problems: string[] = [];
  const databaseUrl = readRequired("DATABASE_URL", problems);
  const config: SocialConfig = {
    host: readOrDefault("HOST", "0.0.0.0"),
    port: Number(readOrDefault("PORT", "8105")),
    databaseUrl,
    identityReadDatabaseUrl: readOrDefault("IDENTITY_READ_DATABASE_URL", databaseUrl),
    domainEventsTopicArn: readOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
    awsRegion: readOrDefault("AWS_REGION", "eu-west-1"),
    awsEndpointUrl: process.env["AWS_ENDPOINT_URL"]?.trim() || undefined,
    outboxPollIntervalMs: Number(readOrDefault("OUTBOX_POLL_INTERVAL_MS", "500")),
    mediaExpiryIntervalMs: Number(readOrDefault("MEDIA_EXPIRY_INTERVAL_MS", String(60 * 60 * 1000))),
    jobsEnabled: readOrDefault("JOBS_ENABLED", "true") === "true",
  };
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (problems.length > 0) throw new Error(`Invalid social configuration: ${problems.join("; ")}`);
  return config;
}
