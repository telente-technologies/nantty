import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";

import { loadCommunicationSettings } from "./communication.config.js";
import { loadCreatorProgramSettings } from "./creators.config.js";
import { loadCopyrightSettings, loadPlatformAdminSettings, loadTrustedProxySettings, loadUsernamePolicySettings } from "./platformAdmin.config.js";
import { loadMonetizationSettings } from "./monetization.config.js";
import { loadAdsSettings, loadIntelligenceSettings } from "./intelligence.config.js";

const MIN_SECRET_LENGTH = 32;
const DURATION_UNITS: Readonly<Record<string, number>> = { s: 1, m: 60, h: 3_600, d: 86_400 };

function readTrimmedSetting(config: ConfigManager, key: string): string {
  return (config.string(key, "") ?? "").trim();
}

function readRequiredSecret(config: ConfigManager, key: string): string {
  const value = readTrimmedSetting(config, key);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new ConfigurationError(`${key.toUpperCase()} must be set to at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return value;
}

function readDurationInSeconds(config: ConfigManager, key: string, fallback: number): number {
  const value = readTrimmedSetting(config, key);
  if (value === "") return fallback;
  const match = /^(\d+)([smhd]?)$/.exec(value);
  const amount = match === null ? Number.NaN : Number(match[1]) * (DURATION_UNITS[match[2] || "s"] ?? 1);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ConfigurationError(`${key.toUpperCase()} must be a duration such as 15m or 30d, got "${value}".`);
  }
  return amount;
}

function readNonNegativeInteger(config: ConfigManager, key: string, fallback: number): number {
  const value = readTrimmedSetting(config, key);
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ConfigurationError(`${key.toUpperCase()} must be a non-negative integer, got "${value}".`);
  }
  return parsed;
}

function readDataEncryptionKey(config: ConfigManager): Uint8Array {
  const key = Buffer.from(readTrimmedSetting(config, "data_encryption_key"), "base64");
  if (key.byteLength !== 32) {
    throw new ConfigurationError("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return new Uint8Array(key);
}

function readCommaSeparatedList(config: ConfigManager, key: string): readonly string[] {
  return readTrimmedSetting(config, key)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readExchangeRateProvider(config: ConfigManager): "static" | "open-exchange-rates-api" {
  const provider = readTrimmedSetting(config, "exchange_rate_provider") || "static";
  if (provider !== "static" && provider !== "open-exchange-rates-api") {
    throw new ConfigurationError(`EXCHANGE_RATE_PROVIDER must be "static" or "open-exchange-rates-api", got "${provider}".`);
  }
  return provider;
}

function readPaymentReturnUrlAllowList(config: ConfigManager): readonly string[] {
  const configured = readCommaSeparatedList(config, "payment_return_urls");
  return configured.length > 0 ? configured : ["zudomart://payments/return"];
}

export function loadApplicationSettings(config: ConfigManager) {
  const accessSecret = readRequiredSecret(config, "jwt_access_secret");
  const refreshSecret = readRequiredSecret(config, "jwt_refresh_secret");
  if (accessSecret === refreshSecret) {
    throw new ConfigurationError("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ.");
  }
  return Object.freeze({
    auth: Object.freeze({
      accessSecret,
      refreshSecret,
      accessTtlSeconds: readDurationInSeconds(config, "access_token_ttl", 900),
      refreshTtlSeconds: readDurationInSeconds(config, "refresh_token_ttl", 30 * 86_400),
      otpTtlSeconds: readNonNegativeInteger(config, "otp_ttl_seconds", 300),
      otpMaxAttempts: readNonNegativeInteger(config, "otp_max_attempts", 5),
      googleClientIds: readCommaSeparatedList(config, "google_client_id"),
      appleClientIds: readCommaSeparatedList(config, "apple_client_id"),
      sensitiveRateLimit: Object.freeze({
        windowMs: readNonNegativeInteger(config, "sensitive_rate_limit_window_ms", 15 * 60_000),
        max: readNonNegativeInteger(config, "sensitive_rate_limit_max", 20),
      }),
    }),
    dataEncryptionKey: readDataEncryptionKey(config),
    money: Object.freeze({
      commissionBps: readNonNegativeInteger(config, "platform_commission_bps", 500),
      escrowInspectionDays: readNonNegativeInteger(config, "escrow_inspection_days", 3),
    }),
    locale: Object.freeze({
      trustedCountryHeader: readTrimmedSetting(config, "trusted_country_header").toLowerCase(),
    }),
    exchangeRates: Object.freeze({
      provider: readExchangeRateProvider(config),
      refreshIntervalMinutes: readNonNegativeInteger(config, "exchange_rate_refresh_minutes", 60),
    }),
    payments: Object.freeze({
      paystackSecretKey: readTrimmedSetting(config, "paystack_secret_key"),
      flutterwaveSecretKey: readTrimmedSetting(config, "flutterwave_secret_key"),
      flutterwaveWebhookHash: readTrimmedSetting(config, "flutterwave_webhook_hash"),
      callbackUrl: readTrimmedSetting(config, "payment_callback_url"),
      returnUrlAllowList: readPaymentReturnUrlAllowList(config),
    }),
    subscriptions: Object.freeze({
      gracePeriodDays: readNonNegativeInteger(config, "subscription_grace_period_days", 3),
    }),
    media: Object.freeze({
      publicBaseUrl: readTrimmedSetting(config, "public_base_url"),
      chunkSizeBytes: readNonNegativeInteger(config, "media_chunk_size_bytes", 5 * 1024 * 1024) || 5 * 1024 * 1024,
      maxImageBytes: readNonNegativeInteger(config, "media_max_image_bytes", 20 * 1024 * 1024),
      maxProfileImageBytes: readNonNegativeInteger(config, "media_max_profile_image_bytes", 10 * 1024 * 1024),
      maxVideoBytes: readNonNegativeInteger(config, "media_max_video_bytes", 200 * 1024 * 1024),
      maxKycBytes: readNonNegativeInteger(config, "media_max_kyc_bytes", 15 * 1024 * 1024),
      maxVoiceBytes: readNonNegativeInteger(config, "media_max_voice_bytes", 10 * 1024 * 1024),
      maxClipSeconds: readNonNegativeInteger(config, "media_max_clip_seconds", 180),
      maxStorySeconds: readNonNegativeInteger(config, "media_max_story_seconds", 60),
      maxVideoSeconds: readNonNegativeInteger(config, "media_max_video_seconds", 600),
      processingMaxAttempts: readNonNegativeInteger(config, "media_processing_max_attempts", 4) || 1,
      processingBackoffMs: readNonNegativeInteger(config, "media_processing_backoff_ms", 5_000),
      processingConcurrency: readNonNegativeInteger(config, "media_processing_concurrency", 2) || 1,
      abandonedUploadSeconds: readDurationInSeconds(config, "media_abandoned_upload_after", 86_400),
      ffmpegPath: readTrimmedSetting(config, "ffmpeg_path") || "ffmpeg",
      ffprobePath: readTrimmedSetting(config, "ffprobe_path") || "ffprobe",
    }),
    creators: loadCreatorProgramSettings(config),
    communication: loadCommunicationSettings(config),
    platformAdmin: loadPlatformAdminSettings(config),
    usernames: loadUsernamePolicySettings(config),
    copyright: loadCopyrightSettings(config),
    trustedProxies: loadTrustedProxySettings(config),
    monetization: loadMonetizationSettings(config),
    intelligence: loadIntelligenceSettings(config),
    ads: loadAdsSettings(config),
  });
}

export type AppSettings = ReturnType<typeof loadApplicationSettings>;
