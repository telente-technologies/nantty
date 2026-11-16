export interface SandboxConfig {
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly controlToken: string;
  readonly webhookSecretEncryptionKey: Buffer | null;
}

export function loadSandboxConfig(environment: NodeJS.ProcessEnv): SandboxConfig {
  const databaseUrl = required(environment, "SANDBOX_DATABASE_URL");
  const controlToken = required(environment, "SANDBOX_CONTROL_TOKEN");
  if (controlToken.length < 32) throw new Error("SANDBOX_CONTROL_TOKEN must contain at least 32 characters");
  const webhookSecretEncryptionKey = parseWebhookEncryptionKey(environment["SANDBOX_WEBHOOK_SECRET_ENCRYPTION_KEY"]);
  const sandboxTarget = parseDatabaseTarget(databaseUrl, "SANDBOX_DATABASE_URL");
  const productionUrl = environment["PRODUCTION_DATABASE_URL"]?.trim();
  if (environment["NODE_ENV"] === "production" && !productionUrl) throw new Error("PRODUCTION_DATABASE_URL is required in production to verify Sandbox isolation");
  if (productionUrl && sameDatabase(sandboxTarget, parseDatabaseTarget(productionUrl, "PRODUCTION_DATABASE_URL"))) {
    throw new Error("Sandbox and production database targets must be different");
  }
  const port = Number(environment["PORT"] ?? "8090");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
  return { host: environment["HOST"]?.trim() || "0.0.0.0", port, databaseUrl, controlToken, webhookSecretEncryptionKey };
}

function parseWebhookEncryptionKey(value: string | undefined): Buffer | null {
  const encoded = value?.trim();
  if (!encoded) return null;
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new Error("SANDBOX_WEBHOOK_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

interface DatabaseTarget {
  readonly host: string;
  readonly port: string;
  readonly database: string;
}

function parseDatabaseTarget(value: string, name: string): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error(`${name} must use PostgreSQL`);
  if (!url.hostname || !url.pathname || url.pathname === "/") throw new Error(`${name} must identify a database`);
  return { host: url.hostname.toLowerCase(), port: url.port || "5432", database: decodeURIComponent(url.pathname.slice(1)) };
}

function sameDatabase(left: DatabaseTarget, right: DatabaseTarget): boolean {
  return left.host === right.host && left.port === right.port && left.database === right.database;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim() ?? "";
  if (!value) throw new Error(`${name} is required`);
  return value;
}
