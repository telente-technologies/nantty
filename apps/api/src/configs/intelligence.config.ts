import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";

const MINIMUM_SHARED_SECRET_LENGTH = 32;
const MAXIMUM_EVENTS_PER_BATCH = 500;
const MAX_BASIS_POINTS = 10_000;

function readSetting(config: ConfigManager, key: string): string {
  return (config.string(key, "") ?? "").trim();
}

function readWholeNumber(config: ConfigManager, key: string, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const value = readSetting(config, key);
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ConfigurationError(`${key.toUpperCase()} must be a whole number between ${minimum} and ${maximum}, got "${value}".`);
  }
  return parsed;
}

function readOptionalSecret(config: ConfigManager, key: string): string {
  const value = readSetting(config, key);
  if (value !== "" && value.length < MINIMUM_SHARED_SECRET_LENGTH) {
    throw new ConfigurationError(`${key.toUpperCase()} must be empty (disabled) or at least ${MINIMUM_SHARED_SECRET_LENGTH} characters.`);
  }
  return value;
}

function readBaseUrl(config: ConfigManager): string {
  const value = readSetting(config, "intelligence_base_url").replace(/\/+$/, "");
  if (value !== "" && !/^https?:\/\/[^\s/?#]+/.test(value)) {
    throw new ConfigurationError(`INTELLIGENCE_BASE_URL must be an http(s) URL, got "${value}".`);
  }
  return value;
}

export function loadIntelligenceSettings(config: ConfigManager) {
  return Object.freeze({
    baseUrl: readBaseUrl(config),
    sharedSecret: readOptionalSecret(config, "intelligence_shared_secret"),
    identifierHashSecret: readOptionalSecret(config, "intelligence_id_hash_secret"),
    timeouts: Object.freeze({
      rankingMs: readWholeNumber(config, "intelligence_ranking_timeout_ms", 100, 1),
      socialProofMs: readWholeNumber(config, "intelligence_social_proof_timeout_ms", 80, 1),
      adsMs: readWholeNumber(config, "intelligence_ads_timeout_ms", 120, 1),
      recommendationsMs: readWholeNumber(config, "intelligence_recommendations_timeout_ms", 150, 1),
      eventsMs: readWholeNumber(config, "intelligence_events_timeout_ms", 2_000, 1),
    }),
    breaker: Object.freeze({
      consecutiveFailuresToOpen: readWholeNumber(config, "intelligence_breaker_failure_threshold", 5, 1),
      errorRatePercentToOpen: readWholeNumber(config, "intelligence_breaker_error_rate_percent", 50, 1, 100),
      errorRateWindowMs: readWholeNumber(config, "intelligence_breaker_window_ms", 10_000, 1),
      minimumRequestsForErrorRate: readWholeNumber(config, "intelligence_breaker_minimum_requests", 10, 1),
      halfOpenAfterMs: readWholeNumber(config, "intelligence_breaker_half_open_after_ms", 5_000, 1),
    }),
    events: Object.freeze({
      batchSize: readWholeNumber(config, "intelligence_event_batch_size", 200, 1, MAXIMUM_EVENTS_PER_BATCH),
      flushIntervalSeconds: readWholeNumber(config, "intelligence_event_flush_interval_seconds", 5, 1),
      maxAttempts: readWholeNumber(config, "intelligence_event_max_attempts", 6, 1),
      retryBackoffMs: readWholeNumber(config, "intelligence_event_retry_backoff_ms", 1_000, 1),
    }),
  });
}

export function loadAdsSettings(config: ConfigManager) {
  return Object.freeze({
    creatorRevenueShareBps: readWholeNumber(config, "ad_creator_revenue_share_bps", 4_000, 0, MAX_BASIS_POINTS),
    clickAttributionWindowDays: readWholeNumber(config, "ad_click_attribution_window_days", 7, 1, 28),
    maximumClicksPerViewerPerHour: readWholeNumber(config, "ad_max_clicks_per_viewer_per_hour", 20, 1),
    servedAdLifetimeHours: readWholeNumber(config, "ad_served_lifetime_hours", 24, 1),
  });
}

export type IntelligenceSettings = ReturnType<typeof loadIntelligenceSettings>;
export type AdsSettings = ReturnType<typeof loadAdsSettings>;
