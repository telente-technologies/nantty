import {
  createConfigManager,
  createEnvironmentConfigSource,
  type ConfigManager,
} from "@zudojs/config";
import { resolveEnvironment } from "@zudojs/constants";
import { ConfigurationError } from "@zudojs/errors";

import { loadApplicationSettings } from "./settings.config.js";

const DEFAULT_PORT = 3000;

function loadDotEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function text(config: ConfigManager, key: string, fallback: string): string {
  return config.string(key, fallback) ?? fallback;
}

export function list(config: ConfigManager, key: string): readonly string[] {
  return (config.string(key, "") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function int(config: ConfigManager, key: string, fallback: number): number {
  const raw = config.string(key);
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ConfigurationError(`${key.toUpperCase()} must be a non-negative integer, got "${raw}".`);
  }
  return value;
}

function combineAllowedBrowserOrigins(config: ConfigManager): readonly string[] {
  const origins = [...list(config, "cors_origins"), text(config, "dashboard_origin", ""), text(config, "ads_manager_origin", ""), text(config, "marketing_site_origin", "")];
  return [...new Set(origins.map((origin) => origin.trim().replace(/\/+$/, "")).filter((origin) => origin.length > 0))];
}

function port(config: ConfigManager): number {
  const raw = config.string("port");
  if (raw === undefined || raw.trim() === "") return DEFAULT_PORT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new ConfigurationError(`PORT must be an integer between 0 and 65535, got "${raw}".`);
  }
  return value;
}

export async function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env === process.env) loadDotEnv();
  const config = createConfigManager({
    sources: [createEnvironmentConfigSource({ env })],
  });
  await config.load();

  return Object.freeze({
    // NODE_ENV is read here, once, the way the framework reads it: `prod`
    // and `Production` are production, an unknown value warns once. app.ts
    // and server.ts take the resolved value from this object.
    nodeEnv: resolveEnvironment({ NODE_ENV: text(config, "node_env", "development") }),
    host: text(config, "host", "0.0.0.0"),
    port: port(config),
    corsOrigins: combineAllowedBrowserOrigins(config),
    rateLimit: Object.freeze({
      windowMs: int(config, "rate_limit_window_ms", 60_000),
      max: int(config, "rate_limit_max", 300),
    }),
    // zudojs:config:start
    database: Object.freeze({ url: text(config, "database_url", "") }),
    redis: Object.freeze({ url: text(config, "redis_url", "redis://localhost:6379") }),
    cache: Object.freeze({ maxEntries: int(config, "cache_max_entries", 10_000), defaultTtlMs: int(config, "cache_default_ttl_ms", 60_000) }),
    storage: Object.freeze({ directory: text(config, "storage_directory", "./.data/storage") }),
    websockets: Object.freeze({ path: text(config, "websocket_path", "/ws") }),
    email: Object.freeze({ transport: text(config, "email_transport", "console"), from: text(config, "email_from", "no-reply@localhost"), smtpHost: text(config, "smtp_host", "localhost"), smtpPort: int(config, "smtp_port", 1025), smtpSecure: text(config, "smtp_secure", "false") === "true", smtpUser: text(config, "smtp_user", ""), smtpPassword: text(config, "smtp_password", "") }),
    // zudojs:config:end
    ...loadApplicationSettings(config),
  });
}

export type AppConfig = Awaited<ReturnType<typeof loadConfig>>;
