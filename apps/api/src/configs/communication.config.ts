import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";

export const DEFAULT_SUPPORT_NOTIFICATION_EMAILS = ["support@zudomart.com"] as const;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function readSetting(config: ConfigManager, key: string): string {
  return (config.string(key, "") ?? "").trim();
}

function readPositiveWholeNumber(config: ConfigManager, key: string, fallback: number): number {
  const value = readSetting(config, key);
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ConfigurationError(`${key.toUpperCase()} must be a positive whole number, got "${value}".`);
  }
  return parsed;
}

function readSupportNotificationEmails(config: ConfigManager): readonly string[] {
  const configured = readSetting(config, "support_notification_emails")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  const recipients = configured.length > 0 ? configured : [...DEFAULT_SUPPORT_NOTIFICATION_EMAILS];
  for (const recipient of recipients) {
    if (!EMAIL_ADDRESS_PATTERN.test(recipient)) throw new ConfigurationError(`SUPPORT_NOTIFICATION_EMAILS has an invalid address: "${recipient}".`);
  }
  return recipients;
}

export function loadCommunicationSettings(config: ConfigManager) {
  return Object.freeze({
    supportNotificationEmails: readSupportNotificationEmails(config),
    realtimeTicketTtlSeconds: readPositiveWholeNumber(config, "realtime_ticket_ttl_seconds", 30),
    realtimeMaxConnectionsPerUser: readPositiveWholeNumber(config, "realtime_max_connections_per_user", 5),
    realtimeMaxBufferedBytes: readPositiveWholeNumber(config, "realtime_max_buffered_bytes", 1024 * 1024),
    realtimeHeartbeatSeconds: readPositiveWholeNumber(config, "realtime_heartbeat_seconds", 30),
    maximumGroupMembers: readPositiveWholeNumber(config, "chat_max_group_members", 256),
    automationDefaultExecutionsPerHour: readPositiveWholeNumber(config, "automation_default_executions_per_hour", 60),
  });
}

export type CommunicationSettings = ReturnType<typeof loadCommunicationSettings>;
