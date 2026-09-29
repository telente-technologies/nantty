import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";

import { BLUE_VERIFICATION_TIERS, type BlueVerificationTier } from "../interfaces/creatorEligibility.interface.js";

const MAX_BASIS_POINTS = 10_000;

function readSetting(config: ConfigManager, key: string): string {
  return (config.string(key, "") ?? "").trim();
}

function readWholeNumber(config: ConfigManager, key: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const value = readSetting(config, key);
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new ConfigurationError(`${key.toUpperCase()} must be a whole number between 0 and ${maximum}, got "${value}".`);
  }
  return parsed;
}

function readTrueOrFalse(config: ConfigManager, key: string, fallback: boolean): boolean {
  const value = readSetting(config, key).toLowerCase();
  if (value === "") return fallback;
  if (value !== "true" && value !== "false") throw new ConfigurationError(`${key.toUpperCase()} must be true or false, got "${value}".`);
  return value === "true";
}

function readRequiredBlueTiers(config: ConfigManager): readonly BlueVerificationTier[] {
  const raw = config.string("creator_required_blue_tiers");
  if (raw === undefined) return ["VERIFIED", "PREMIUM"];
  const tiers = raw.split(",").map((tier) => tier.trim().toUpperCase()).filter((tier) => tier.length > 0);
  const unknown = tiers.filter((tier) => !(BLUE_VERIFICATION_TIERS as readonly string[]).includes(tier));
  if (unknown.length > 0) throw new ConfigurationError(`CREATOR_REQUIRED_BLUE_TIERS has unknown tiers: ${unknown.join(", ")}.`);
  return tiers as BlueVerificationTier[];
}

export function loadCreatorProgramSettings(config: ConfigManager) {
  return Object.freeze({
    minimumAccountAgeDays: readWholeNumber(config, "creator_min_account_age_days", 30),
    requireVerifiedEmail: readTrueOrFalse(config, "creator_require_verified_email", true),
    requiredBlueTiers: readRequiredBlueTiers(config),
    minimumFollowers: readWholeNumber(config, "creator_min_followers", 0),
    minimumPosts: readWholeNumber(config, "creator_min_posts", 0),
    violationLookbackDays: readWholeNumber(config, "creator_violation_lookback_days", 90),
    liveGiftPlatformCutBps: readWholeNumber(config, "live_gift_platform_cut_bps", 3_000, MAX_BASIS_POINTS),
    maximumAffiliateCommissionBps: readWholeNumber(config, "affiliate_max_commission_bps", 5_000, MAX_BASIS_POINTS),
  });
}

export type CreatorProgramSettings = ReturnType<typeof loadCreatorProgramSettings>;
