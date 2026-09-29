import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";

const DURATION_UNITS: Readonly<Record<string, number>> = { s: 1, m: 60, h: 3_600, d: 86_400 };

function readSetting(config: ConfigManager, key: string): string {
  return (config.string(key, "") ?? "").trim();
}

function readPositiveWholeNumber(config: ConfigManager, key: string, fallback: number): number {
  const value = readSetting(config, key);
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new ConfigurationError(`${key.toUpperCase()} must be a positive whole number, got "${value}".`);
  return parsed;
}

function readDurationSeconds(config: ConfigManager, key: string, fallback: number): number {
  const value = readSetting(config, key);
  if (value === "") return fallback;
  const match = /^(\d+)([smhd]?)$/.exec(value);
  const amount = match === null ? Number.NaN : Number(match[1]) * (DURATION_UNITS[match[2] || "s"] ?? 1);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ConfigurationError(`${key.toUpperCase()} must be a duration such as 10m or 8h, got "${value}".`);
  return amount;
}

export function readEmailList(config: ConfigManager, key: string): readonly string[] {
  return readSetting(config, key)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function loadPlatformAdminSettings(config: ConfigManager) {
  return Object.freeze({
    accessTtlSeconds: readDurationSeconds(config, "admin_access_token_ttl", 300),
    sessionTtlSeconds: readDurationSeconds(config, "admin_session_ttl", 8 * 3_600),
    stepUpWindowSeconds: readDurationSeconds(config, "admin_step_up_window", 10 * 60),
    loginChallengeTtlSeconds: readDurationSeconds(config, "admin_login_challenge_ttl", 5 * 60),
    maxMfaAttempts: readPositiveWholeNumber(config, "admin_max_mfa_attempts", 5),
    totpIssuer: readSetting(config, "admin_totp_issuer") || "Zudomart Admin",
  });
}

export function loadUsernamePolicySettings(config: ConfigManager) {
  return Object.freeze({
    changeCooldownDays: readPositiveWholeNumber(config, "username_change_cooldown_days", 30),
    maxChangesPerYear: readPositiveWholeNumber(config, "username_max_changes_per_year", 3),
    quarantineDays: readPositiveWholeNumber(config, "username_quarantine_days", 30),
  });
}

export function loadCopyrightSettings(config: ConfigManager) {
  return Object.freeze({
    strikeSuspensionThreshold: readPositiveWholeNumber(config, "copyright_strike_suspension_threshold", 3),
    strikeLifetimeDays: readPositiveWholeNumber(config, "copyright_strike_lifetime_days", 365),
    counterNoticeWindowDays: readPositiveWholeNumber(config, "copyright_counter_notice_window_days", 14),
  });
}
