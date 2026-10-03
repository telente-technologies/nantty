import { failValidation } from "@/mocks/mockResponses.mock";
import type { CheckmarkPricingRules, CheckmarkSuggestionRules, CreatorProgramThresholds, TrialRules } from "@/types/platformConfiguration.type";

import { readBooleanValue, readMoneyValue, readEnumFromObject, readIntegerBetween, readObjectAtPath } from "./configurationFieldReaders.mock";

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
    minimumAccountAgeDays: readIntegerBetween(auto, "minimumAccountAgeDays", "content.autoApprove", 0, 3650),
    requiresVerifiedEmail: readBooleanValue(auto, "requiresVerifiedEmail", "content.autoApprove"),
    requiresVerifiedPhone: readBooleanValue(auto, "requiresVerifiedPhone", "content.autoApprove"),
    minimumRealFollowers: readIntegerBetween(auto, "minimumRealFollowers", "content.autoApprove", 0, 10_000_000),
    minimumOriginalPostsInLast60Days: readIntegerBetween(auto, "minimumOriginalPostsInLast60Days", "content.autoApprove", 0, 1000),
    noViolationsInDays: readIntegerBetween(auto, "noViolationsInDays", "content.autoApprove", 0, 730),
    maximumFraudScore: readIntegerBetween(auto, "maximumFraudScore", "content.autoApprove", 0, 100),
  };
  const manualReview = {
    minimumRealFollowers: readIntegerBetween(manual, "minimumRealFollowers", "content.manualReview", 0, 10_000_000),
    allowsPastViolation: readBooleanValue(manual, "allowsPastViolation", "content.manualReview"),
    allowsBorderlineOrAiHeavyContent: readBooleanValue(manual, "allowsBorderlineOrAiHeavyContent", "content.manualReview"),
    maximumRiskScore: readIntegerBetween(manual, "maximumRiskScore", "content.manualReview", 0, 100),
  };
  if (manualReview.minimumRealFollowers > autoApprove.minimumRealFollowers) failValidation("content.manualReview.minimumRealFollowers", "Manual review must start at or below the auto-approve follower count.");
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
    onePerPhone: readBooleanValue(content, "onePerPhone", "content"),
    maximumRiskScore: readIntegerBetween(content, "maximumRiskScore", "content", 0, 100),
    minimumCompletedOrders: readIntegerBetween(content, "minimumCompletedOrders", "content", 0, 100_000),
  };
}

export function validateCheckmarkPricing(rawContent: unknown): CheckmarkPricingRules {
  const content = readObjectAtPath(rawContent, "content");
  const blueMonthlyPrice = readMoneyValue(content.blueMonthlyPrice, "content.blueMonthlyPrice", ["NGN"], "NGN");
  const goldOnlyMonthlyPrice = readMoneyValue(content.goldOnlyMonthlyPrice, "content.goldOnlyMonthlyPrice", ["NGN"], "NGN");
  const blackMonthlyPrice = readMoneyValue(content.blackMonthlyPrice, "content.blackMonthlyPrice", ["NGN"], "NGN");
  if (goldOnlyMonthlyPrice.amountMinor >= 500_000) failValidation("content.goldOnlyMonthlyPrice", "Gold-only must stay cheaper than seller Pro (NGN 5,000).");
  return {
    bundleDiscountPercent: readIntegerBetween(content, "bundleDiscountPercent", "content", 0, 50),
    bundleMaximumBusinesses: readIntegerBetween(content, "bundleMaximumBusinesses", "content", 1, 20),
    blueMonthlyPrice,
    goldOnlyMonthlyPrice,
    blackMonthlyPrice,
    blackGraceDays: readIntegerBetween(content, "blackGraceDays", "content", 0, 90),
  };
}
