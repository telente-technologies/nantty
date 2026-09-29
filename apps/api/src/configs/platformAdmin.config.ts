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

function readList(config: ConfigManager, key: string): readonly string[] {
  return readSetting(config, key)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function loadPlatformAdminSettings(config: ConfigManager) {
  const consoleUrl = readSetting(config, "admin_console_url") || "http://localhost:3002";
  return Object.freeze({
    accessTtlSeconds: readDurationSeconds(config, "admin_access_token_ttl", 600),
    sessionTtlSeconds: readDurationSeconds(config, "admin_session_ttl", 12 * 3_600),
    stepUpTtlSeconds: readDurationSeconds(config, "admin_step_up_ttl", 300),
    mfaChallengeTtlSeconds: readDurationSeconds(config, "admin_mfa_challenge_ttl", 300),
    maxMfaAttempts: readPositiveWholeNumber(config, "admin_max_mfa_attempts", 5),
    maxFailedPasswordAttempts: readPositiveWholeNumber(config, "admin_max_failed_passwords", 5),
    lockoutSeconds: readDurationSeconds(config, "admin_lockout_duration", 15 * 60),
    invitationTtlSeconds: readDurationSeconds(config, "admin_invitation_ttl", 48 * 3_600),
    invitationEmailDomains: readEmailList(config, "admin_invitation_email_domains"),
    ipAllowList: readList(config, "admin_ip_allowlist"),
    consoleUrl,
    totpIssuer: readSetting(config, "admin_totp_issuer") || "Zudomart Admin",
    webAuthn: Object.freeze({
      relyingPartyId: readSetting(config, "admin_webauthn_rp_id") || new URL(consoleUrl).hostname,
      relyingPartyName: readSetting(config, "admin_webauthn_rp_name") || "Zudomart Admin",
      origins: readList(config, "admin_webauthn_origins").length > 0 ? readList(config, "admin_webauthn_origins") : [consoleUrl],
    }),
  });
}

export function loadTrustedProxySettings(config: ConfigManager): number | readonly string[] | false {
  const addresses = readList(config, "trusted_proxy_addresses");
  if (addresses.length > 0) return addresses;
  const count = readSetting(config, "trusted_proxy_count");
  if (count === "") return false;
  const hops = Number(count);
  if (!Number.isSafeInteger(hops) || hops < 0) throw new ConfigurationError(`TRUSTED_PROXY_COUNT must be a whole number, got "${count}".`);
  return hops === 0 ? false : hops;
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
