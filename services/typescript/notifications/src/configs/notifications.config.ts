export interface NotificationsConfig {
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly databaseSchema: string;
  readonly aws: { readonly region: string; readonly endpoint: string | undefined };
  readonly messageBus: "rabbitmq" | "sqs";
  readonly rabbitMq: { readonly url: string; readonly prefetch: number };
  readonly queues: { readonly domainEvents: string; readonly jobs: string; readonly sesFeedback: string };
  readonly consumersEnabled: boolean;
  readonly email: { readonly fromAddress: string; readonly configurationSet: string };
  readonly identity: { readonly baseUrl: string; readonly internalToken: string };
  readonly auth: { readonly jwksUrl: string; readonly issuer: string; readonly staffIssuer: string; readonly audience: string };
  readonly unsubscribeSigningSecret: string;
  readonly publicApiBaseUrl: string;
  readonly webBaseUrl: string;
  readonly otpEnvelopeKeys: Readonly<Record<string, Buffer>>;
  readonly marketingMaxPerWeek: number;
  readonly policyNotice: { readonly batchSize: number; readonly ratePerSecond: number; readonly autoSend: boolean };
  readonly digestSource: { readonly baseUrl: string; readonly internalToken: string } | null;
  readonly pushProvider: "expo" | "log";
  readonly emailProvider?: "ses" | "log";
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

export function loadNotificationsConfigFromEnvironment(): NotificationsConfig {
  const problems: string[] = [];
  const authIssuer = readRequired("AUTH_TOKEN_ISSUER", problems);
  const messageBus = readOrDefault("EVENT_BUS", "rabbitmq") === "sqs" ? "sqs" : "rabbitmq";
  const config: NotificationsConfig = {
    host: readOrDefault("HOST", "0.0.0.0"),
    port: Number(readOrDefault("PORT", "8104")),
    databaseUrl: readRequired("DATABASE_URL", problems),
    databaseSchema: readOrDefault("DATABASE_SCHEMA", "notifications"),
    aws: { region: readOrDefault("AWS_REGION", "eu-west-1"), endpoint: process.env["AWS_ENDPOINT_URL"]?.trim() || undefined },
    messageBus,
    rabbitMq: { url: messageBus === "rabbitmq" ? readRequired("RABBITMQ_URL", problems) : "", prefetch: Number(readOrDefault("RABBITMQ_PREFETCH", "20")) },
    queues: messageBus === "rabbitmq"
      ? { domainEvents: readOrDefault("NOTIFICATIONS_DOMAIN_EVENTS_QUEUE", "notifications-domain-events"), jobs: readOrDefault("NOTIFICATIONS_JOBS_QUEUE", "jobs-email"), sesFeedback: readOrDefault("SQS_SES_FEEDBACK_QUEUE_URL", "") }
      : { domainEvents: readRequired("SQS_DOMAIN_EVENTS_QUEUE_URL", problems), jobs: readRequired("SQS_JOBS_QUEUE_URL", problems), sesFeedback: readOrDefault("SQS_SES_FEEDBACK_QUEUE_URL", "") },
    consumersEnabled: readOrDefault("CONSUMERS_ENABLED", "true") === "true",
    email: { fromAddress: readRequired("SES_FROM_ADDRESS", problems), configurationSet: readRequired("SES_CONFIGURATION_SET", problems) },
    identity: { baseUrl: readRequired("IDENTITY_INTERNAL_URL", problems), internalToken: readRequired("IDENTITY_INTERNAL_TOKEN", problems) },
    auth: { jwksUrl: readRequired("AUTH_JWKS_URL", problems), issuer: authIssuer, staffIssuer: readOrDefault("STAFF_TOKEN_ISSUER", authIssuer), audience: readOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api") },
    unsubscribeSigningSecret: readRequired("UNSUBSCRIBE_SIGNING_SECRET", problems),
    publicApiBaseUrl: readRequired("PUBLIC_API_BASE_URL", problems),
    otpEnvelopeKeys: { [readOrDefault("AUTH_OTP_EVENT_KEY_ID", "otp-1")]: Buffer.from(readOrDefault("AUTH_OTP_EVENT_KEY", ""), "base64") },
    webBaseUrl: readOrDefault("ZUDOMART_WEB_BASE_URL", "https://zudomart.com"),
    marketingMaxPerWeek: Number(readOrDefault("MARKETING_MAX_PER_WEEK", "3")),
    policyNotice: {
      batchSize: Number(readOrDefault("POLICY_NOTICE_BATCH_SIZE", "200")),
      ratePerSecond: Number(readOrDefault("POLICY_NOTICE_RATE_PER_SECOND", "14")),
      autoSend: readOrDefault("POLICY_NOTICE_AUTO_SEND", "false") === "true",
    },
    digestSource: process.env["SOCIAL_INTERNAL_URL"]?.trim() ? { baseUrl: process.env["SOCIAL_INTERNAL_URL"].trim(), internalToken: process.env["SOCIAL_INTERNAL_TOKEN"]?.trim() ?? "" } : null,
    pushProvider: readOrDefault("PUSH_PROVIDER", "log") === "expo" ? "expo" : "log",
    emailProvider: readOrDefault("EMAIL_PROVIDER", "ses") === "log" ? "log" : "ses",
  };
  if (config.emailProvider === "log" && process.env["NODE_ENV"] === "production") problems.push("EMAIL_PROVIDER=log is for local development only");
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (config.unsubscribeSigningSecret.length > 0 && config.unsubscribeSigningSecret.length < 32) problems.push("UNSUBSCRIBE_SIGNING_SECRET must be at least 32 characters");
  if (!(config.policyNotice.batchSize > 0) || !(config.policyNotice.ratePerSecond > 0)) problems.push("POLICY_NOTICE_BATCH_SIZE and POLICY_NOTICE_RATE_PER_SECOND must be positive");
  if (!(config.rabbitMq.prefetch > 0)) problems.push("RABBITMQ_PREFETCH must be positive");
  if (problems.length > 0) throw new Error(`Invalid notifications configuration: ${problems.join("; ")}`);
  return config;
}
