import { failValidation } from "@/mocks/mockResponses.mock";
import type { CheckmarkPricingRules, CheckmarkSuggestionRules, CreatorProgramThresholds, TrialRules } from "@/types/platformConfiguration.type";

import { readBooleanValue, readEnumFromObject, readIntegerBetween, readObjectAtPath } from "./configurationFieldReaders.mock";

export function validateCheckmarkSuggestionRules(rawContent: unknown): CheckmarkSuggestionRules {
  const content = readObjectAtPath(rawContent, "content");
  const blue = readObjectAtPath(content.blue, "content.blue");
  const gold = readObjectAtPath(content.gold, "content.gold");
  return {
    blue: {
      requiresIdVerified: readBooleanValue(blue, "requiresIdVerified", "content.blue"),
      minimumAccountAgeDays: readIntegerBetween(blue, "minimumAccountAgeDays", "content.blue", 0, 3650),
      minimumRealFollowers: readIntegerBetween(blue, "minimumRealFollowers", "content.blue", 0, 10_000_000),
      noViolationsInDays: readIntegerBetween(blue, "noViolationsInDays", "content.blue", 0, 730),
    },
    gold: {
      requiresBusinessVerification: readBooleanValue(gold, "requiresBusinessVerification", "content.gold"),
      requiresActiveStoreOrBrandPage: readBooleanValue(gold, "requiresActiveStoreOrBrandPage", "content.gold"),
      minimumCompletedOrders: readIntegerBetween(gold, "minimumCompletedOrders", "content.gold", 0, 100_000),
      minimumSuccessRatePercent: readIntegerBetween(gold, "minimumSuccessRatePercent", "content.gold", 0, 100),
    },
  };
}

export function validateCreatorThresholds(rawContent: unknown): CreatorProgramThresholds {
  const content = readObjectAtPath(rawContent, "content");
  const auto = readObjectAtPath(content.autoApprove, "content.autoApprove");
  const manual = readObjectAtPath(content.manualReview, "content.manualReview");
  const autoApprove = {
    minimumAccountAgeDays: readIntegerBetween(auto, "minimumAccountAgeDays", "content.autoApprove", 30, 3650),
    requiresVerifiedEmail: readBooleanValue(auto, "requiresVerifiedEmail", "content.autoApprove"),
    minimumRealFollowers: readIntegerBetween(auto, "minimumRealFollowers", "content.autoApprove", 10_000, 100_000_000),
    minimumVerifiedFollowers: readIntegerBetween(auto, "minimumVerifiedFollowers", "content.autoApprove", 500, 100_000_000),
    minimumQualifyingImpressionsLast30Days: readIntegerBetween(auto, "minimumQualifyingImpressionsLast30Days", "content.autoApprove", 100_000, 1_000_000_000),
    minimumOriginalPostsInLast60Days: readIntegerBetween(auto, "minimumOriginalPostsInLast60Days", "content.autoApprove", 10, 100_000),
    noViolationsInDays: readIntegerBetween(auto, "noViolationsInDays", "content.autoApprove", 90, 3650),
    maximumFraudScore: readIntegerBetween(auto, "maximumFraudScore", "content.autoApprove", 0, 100),
  };
  const manualReview = {
    allowsPastViolation: readBooleanValue(manual, "allowsPastViolation", "content.manualReview"),
    allowsBorderlineOrAiHeavyContent: readBooleanValue(manual, "allowsBorderlineOrAiHeavyContent", "content.manualReview"),
    maximumRiskScore: readIntegerBetween(manual, "maximumRiskScore", "content.manualReview", 0, 100),
  };
  if (manualReview.maximumRiskScore < autoApprove.maximumFraudScore) failValidation("content.manualReview.maximumRiskScore", "Manual review must allow at least the auto-approve risk level.");
  return { autoApprove, manualReview };
}

export function validateTrialRules(rawContent: unknown): TrialRules {
  const content = readObjectAtPath(rawContent, "content");
  return {
    trialLength: readEnumFromObject(content, "trialLength", "content", ["DAYS_7", "MONTH_1"] as const),
    yearlyDiscountPercent: readIntegerBetween(content, "yearlyDiscountPercent", "content", 0, 60),
    minimumAccountAgeDays: readIntegerBetween(content, "minimumAccountAgeDays", "content", 0, 3650),
    requiresVerifiedEmail: readBooleanValue(content, "requiresVerifiedEmail", "content"),
    onePerPerson: readBooleanValue(content, "onePerPerson", "content"),
    onePerCard: readBooleanValue(content, "onePerCard", "content"),
    onePerDevice: readBooleanValue(content, "onePerDevice", "content"),
    maximumRiskScore: readIntegerBetween(content, "maximumRiskScore", "content", 0, 100),
    minimumCompletedOrders: readIntegerBetween(content, "minimumCompletedOrders", "content", 0, 100_000),
  };
}

export function validateCheckmarkPricing(rawContent: unknown): CheckmarkPricingRules {
  const content = readObjectAtPath(rawContent, "content");
  return {
    bundleDiscountPercent: readIntegerBetween(content, "bundleDiscountPercent", "content", 0, 50),
    bundleMaximumBusinesses: readIntegerBetween(content, "bundleMaximumBusinesses", "content", 1, 20),
    blackGraceDays: readIntegerBetween(content, "blackGraceDays", "content", 0, 90),
    ...validateMultiBusinessGoldPricing(content),
  };
}

function readOptionalIntegerBetween(content: Record<string, unknown>, key: string, fallback: number, minimum: number, maximum: number): number {
  return content[key] === undefined ? fallback : readIntegerBetween(content, key, "content", minimum, maximum);
}

function validateMultiBusinessGoldPricing(content: Record<string, unknown>): Omit<Required<CheckmarkPricingRules>, "bundleDiscountPercent" | "bundleMaximumBusinesses" | "blackGraceDays"> {
  const multiBusinessBasePercent = readOptionalIntegerBetween(content, "multiBusinessBasePercent", 10, 0, 90);
  const multiBusinessStepPercent = readOptionalIntegerBetween(content, "multiBusinessStepPercent", 2, 0, 90);
  const multiBusinessMaximumProfiles = readOptionalIntegerBetween(content, "multiBusinessMaximumProfiles", 5, 1, 5);
  if (multiBusinessBasePercent + multiBusinessStepPercent * Math.max(0, multiBusinessMaximumProfiles - 2) > 90) {
    failValidation("content.multiBusinessStepPercent", "The biggest multi-business discount (base + step for each profile after the second) can be at most 90%.");
  }
  return {
    multiBusinessSingleProfilePercent: readOptionalIntegerBetween(content, "multiBusinessSingleProfilePercent", 5, 0, 90),
    multiBusinessBasePercent,
    multiBusinessStepPercent,
    multiBusinessMaximumProfiles,
    multiBusinessYearlyExtraPercent: readOptionalIntegerBetween(content, "multiBusinessYearlyExtraPercent", 5, 0, 90),
    multiBusinessYearlyMode: content.multiBusinessYearlyMode === undefined ? "replace" : readEnumFromObject(content, "multiBusinessYearlyMode", "content", ["replace", "add"] as const),
  };
}
