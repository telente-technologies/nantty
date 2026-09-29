import type { ConfigManager } from "@zudojs/config";
import { ConfigurationError } from "@zudojs/errors";

import { isSupportedCurrencyCode, type CurrencyCode } from "../enums/currency.enum.js";

const MAX_BASIS_POINTS = 10_000;

export type CoinPurchaseChannel = "web_checkout" | "store_iap";
export type CoinPurchasePlatform = "ios" | "android" | "web";

export interface CoinPurchaseChannelRule {
  readonly platform: CoinPurchasePlatform;
  readonly countryCode: string | null;
  readonly channel: CoinPurchaseChannel;
}

export interface TransferFeeOverride {
  readonly provider: string;
  readonly currency: CurrencyCode;
  readonly feeMinor: number;
}

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

function readChannel(value: string, key: string): CoinPurchaseChannel {
  if (value !== "web_checkout" && value !== "store_iap") throw new ConfigurationError(`${key.toUpperCase()} must be web_checkout or store_iap, got "${value}".`);
  return value;
}

function readAmountsPerCurrency(config: ConfigManager, key: string, fallback: Readonly<Record<CurrencyCode, number>>): Readonly<Record<CurrencyCode, number>> {
  const value = readSetting(config, key);
  if (value === "") return fallback;
  const amounts: Record<string, number> = { ...fallback };
  for (const pair of value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0)) {
    const [currency = "", amount = ""] = pair.split(":");
    const parsed = Number(amount);
    if (!isSupportedCurrencyCode(currency.toUpperCase()) || !Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new ConfigurationError(`${key.toUpperCase()} entries must look like NGN:1000, got "${pair}".`);
    }
    amounts[currency.toUpperCase()] = parsed;
  }
  return amounts as Record<CurrencyCode, number>;
}

function readChannelRules(config: ConfigManager): readonly CoinPurchaseChannelRule[] {
  const key = "coin_purchase_channel_overrides";
  return readSetting(config, key)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [target = "", channel = ""] = entry.split("=");
      const [platform = "", country] = target.split(":");
      if (platform !== "ios" && platform !== "android" && platform !== "web") throw new ConfigurationError(`${key.toUpperCase()} has an unknown platform in "${entry}".`);
      return { platform, countryCode: country === undefined || country === "" ? null : country.toUpperCase(), channel: readChannel(channel, key) };
    });
}

function readTransferFeeOverrides(config: ConfigManager): readonly TransferFeeOverride[] {
  const key = "payout_transfer_fee_overrides";
  return readSetting(config, key)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [provider = "", currency = "", fee = ""] = entry.split(":");
      const feeMinor = Number(fee);
      if (provider === "" || !isSupportedCurrencyCode(currency.toUpperCase()) || !Number.isSafeInteger(feeMinor) || feeMinor < 0) {
        throw new ConfigurationError(`${key.toUpperCase()} entries must look like paystack:NGN:5000, got "${entry}".`);
      }
      return { provider, currency: currency.toUpperCase() as CurrencyCode, feeMinor };
    });
}

export const DEFAULT_COIN_CASH_VALUES: Readonly<Record<CurrencyCode, number>> = { NGN: 1_000, GHS: 10, KES: 100, ZAR: 15, GBP: 1, EUR: 1, USD: 1 };
export const DEFAULT_LOYALTY_POINT_VALUES: Readonly<Record<CurrencyCode, number>> = { NGN: 100, GHS: 1, KES: 10, ZAR: 2, GBP: 1, EUR: 1, USD: 1 };
export const DEFAULT_REFERRAL_REWARDS: Readonly<Record<CurrencyCode, number>> = { NGN: 100_000, GHS: 1_000, KES: 10_000, ZAR: 1_500, GBP: 100, EUR: 100, USD: 100 };

export function loadMonetizationSettings(config: ConfigManager) {
  return Object.freeze({
    coins: Object.freeze({
      defaultPurchaseChannel: readChannel(readSetting(config, "coin_purchase_channel") || "web_checkout", "coin_purchase_channel"),
      purchaseChannelRules: readChannelRules(config),
      transferFeeBps: readWholeNumber(config, "coin_transfer_fee_bps", 2_500, MAX_BASIS_POINTS),
      cashValuePerCoinMinor: readAmountsPerCurrency(config, "coin_cash_values", DEFAULT_COIN_CASH_VALUES),
    }),
    creators: Object.freeze({
      minimumPayoutMinor: readWholeNumber(config, "creator_minimum_payout_minor", 1_000),
      subscriptionCreatorShareBps: readWholeNumber(config, "creator_subscription_share_bps", 7_000, MAX_BASIS_POINTS),
      subscriptionPeriodDays: readWholeNumber(config, "creator_subscription_period_days", 30) || 30,
      adsRevenueCreatorShareBps: readWholeNumber(config, "ads_revenue_creator_share_bps", 5_000, MAX_BASIS_POINTS),
    }),
    payouts: Object.freeze({
      transferFeeOverrides: readTransferFeeOverrides(config),
    }),
    loyalty: Object.freeze({
      pointsEarnBps: readWholeNumber(config, "loyalty_points_earn_bps", 100, MAX_BASIS_POINTS),
      pointValueMinor: readAmountsPerCurrency(config, "loyalty_point_values", DEFAULT_LOYALTY_POINT_VALUES),
      minimumPointsToRedeem: readWholeNumber(config, "loyalty_minimum_points_to_redeem", 100),
      defaultCashbackBps: readWholeNumber(config, "cashback_default_bps", 0, MAX_BASIS_POINTS),
      referralRewardMinor: readAmountsPerCurrency(config, "referral_reward_values", DEFAULT_REFERRAL_REWARDS),
      referralShareBaseUrl: readSetting(config, "referral_share_base_url") || "https://zudomart.com/invite",
    }),
  });
}

export type MonetizationSettings = ReturnType<typeof loadMonetizationSettings>;

export function createDefaultMonetizationSettings(): MonetizationSettings {
  return {
    coins: { defaultPurchaseChannel: "web_checkout", purchaseChannelRules: [], transferFeeBps: 2_500, cashValuePerCoinMinor: DEFAULT_COIN_CASH_VALUES },
    creators: { minimumPayoutMinor: 1_000, subscriptionCreatorShareBps: 7_000, subscriptionPeriodDays: 30, adsRevenueCreatorShareBps: 5_000 },
    payouts: { transferFeeOverrides: [] },
    loyalty: {
      pointsEarnBps: 100,
      pointValueMinor: DEFAULT_LOYALTY_POINT_VALUES,
      minimumPointsToRedeem: 100,
      defaultCashbackBps: 0,
      referralRewardMinor: DEFAULT_REFERRAL_REWARDS,
      referralShareBaseUrl: "https://zudomart.com/invite",
    },
  };
}
