import { failValidation } from "@/mocks/mockResponses.mock";
import type { DebtLevelAmounts, PaymentLimitAmounts, PaymentLimits, SellerDebtLimits } from "@/types/platformConfiguration.type";

import { readIntegerBetween, readObjectAtPath } from "./configurationFieldReaders.mock";

const maximumLimitMinor = 1_000_000_000_000;
const currencyPattern = /^[A-Z]{3}$/;

function onlyKeys(content: Record<string, unknown>, path: string, allowed: readonly string[]): void {
  for (const key of Object.keys(content)) if (!allowed.includes(key)) failValidation(`${path}.${key}`, "This is not a limit setting.");
}

function readLimit(content: Record<string, unknown>, key: string, path: string): number {
  return readIntegerBetween(content, key, path, 1, maximumLimitMinor);
}

function readDebtLevels(rawLevels: unknown, path: string): DebtLevelAmounts {
  const levels = readObjectAtPath(rawLevels, path);
  onlyKeys(levels, path, ["unverified", "payoutVerified", "identityVerified"]);
  const read = { unverified: readLimit(levels, "unverified", path), payoutVerified: readLimit(levels, "payoutVerified", path), identityVerified: readLimit(levels, "identityVerified", path) };
  if (read.unverified > read.payoutVerified || read.payoutVerified > read.identityVerified) failValidation(path, "Each verification level must allow at least as much as the one below it.");
  return read;
}

const defaultAdsStepUpAboveMinor = 5_000_000;

function readPaymentAmounts(rawAmounts: unknown, path: string, isBase = false): PaymentLimitAmounts {
  const amounts = readObjectAtPath(rawAmounts, path);
  onlyKeys(amounts, path, ["orderCheckout", "coinPurchase", "adsTopUp", "adsStepUpAbove", "walletDaily"]);
  const daily = readObjectAtPath(amounts["walletDaily"], `${path}.walletDaily`);
  onlyKeys(daily, `${path}.walletDaily`, ["basic", "mid", "full"]);
  const walletDaily = { basic: readLimit(daily, "basic", `${path}.walletDaily`), mid: readLimit(daily, "mid", `${path}.walletDaily`), full: readLimit(daily, "full", `${path}.walletDaily`) };
  if (walletDaily.basic > walletDaily.mid || walletDaily.mid > walletDaily.full) failValidation(`${path}.walletDaily`, "Basic must not exceed mid, and mid must not exceed full.");
  const adsTopUp = readLimit(amounts, "adsTopUp", path);
  const stepUp = amounts["adsStepUpAbove"] === undefined || amounts["adsStepUpAbove"] === 0 ? (isBase ? defaultAdsStepUpAboveMinor : undefined) : readLimit(amounts, "adsStepUpAbove", path);
  if (stepUp !== undefined && stepUp > adsTopUp) failValidation(`${path}.adsStepUpAbove`, "Must not exceed the ads top-up maximum.");
  return { orderCheckout: readLimit(amounts, "orderCheckout", path), coinPurchase: readLimit(amounts, "coinPurchase", path), adsTopUp, ...(stepUp === undefined ? {} : { adsStepUpAbove: stepUp }), walletDaily };
}

function readOverrides<Value>(rawOverrides: unknown, path: string, readValue: (raw: unknown, path: string) => Value): Record<string, Value> {
  const overrides = rawOverrides === undefined ? {} : readObjectAtPath(rawOverrides, path);
  if (Object.keys(overrides).length > 50) failValidation(path, "At most 50 currency overrides.");
  const read: Record<string, Value> = {};
  for (const [currency, value] of Object.entries(overrides)) {
    if (!currencyPattern.test(currency) || currency === "NGN") failValidation(`${path}.${currency}`, "Use an ISO 4217 currency other than NGN.");
    read[currency] = readValue(value, `${path}.${currency}`);
  }
  return read;
}

export function validateSellerDebtLimits(rawContent: unknown): SellerDebtLimits {
  const content = readObjectAtPath(rawContent, "content");
  onlyKeys(content, "content", ["baseMinor", "outsideNigeriaPercent", "trustedSellerAgeDays", "trustedSellerCleanDays", "currencyOverridesMinor"]);
  return {
    baseMinor: readDebtLevels(content["baseMinor"], "content.baseMinor"),
    outsideNigeriaPercent: readIntegerBetween(content, "outsideNigeriaPercent", "content", 1, 100),
    trustedSellerAgeDays: readIntegerBetween(content, "trustedSellerAgeDays", "content", 0, 3650),
    trustedSellerCleanDays: readIntegerBetween(content, "trustedSellerCleanDays", "content", 0, 3650),
    currencyOverridesMinor: readOverrides(content["currencyOverridesMinor"], "content.currencyOverridesMinor", readDebtLevels),
  };
}

export function validatePaymentLimits(rawContent: unknown): PaymentLimits {
  const content = readObjectAtPath(rawContent, "content");
  onlyKeys(content, "content", ["baseMinor", "currencyOverridesMinor"]);
  return {
    baseMinor: readPaymentAmounts(content["baseMinor"], "content.baseMinor", true),
    currencyOverridesMinor: readOverrides(content["currencyOverridesMinor"], "content.currencyOverridesMinor", (raw, path) => readPaymentAmounts(raw, path)),
  };
}

export const defaultSellerDebtLimits: SellerDebtLimits = {
  baseMinor: { unverified: 1_000_000, payoutVerified: 5_000_000, identityVerified: 20_000_000 },
  outsideNigeriaPercent: 50, trustedSellerAgeDays: 90, trustedSellerCleanDays: 90, currencyOverridesMinor: {},
};

export const defaultPaymentLimits: PaymentLimits = {
  baseMinor: { orderCheckout: 500_000_000, coinPurchase: 50_000_000, adsTopUp: 1_000_000_000, adsStepUpAbove: 5_000_000, walletDaily: { basic: 5_000_000, mid: 20_000_000, full: 500_000_000 } },
  currencyOverridesMinor: {},
};
