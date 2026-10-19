import type { CheckmarkPricingRules, CheckmarkSuggestionRules, CreatorProgramThresholds, TrialRules } from "@/types/platformConfiguration.type";

export function buildInitialCheckmarkSuggestionRules(): CheckmarkSuggestionRules {
  return {
    blue: { requiresIdVerified: true, minimumAccountAgeDays: 90, minimumRealFollowers: 1_000, noViolationsInDays: 90 },
    gold: { requiresBusinessVerification: true, requiresActiveStoreOrBrandPage: true, minimumCompletedOrders: 20, minimumSuccessRatePercent: 90 },
  };
}

export function buildInitialCreatorThresholds(): CreatorProgramThresholds {
  return {
    autoApprove: { minimumAccountAgeDays: 30, requiresVerifiedEmail: true, minimumRealFollowers: 1_000, minimumOriginalPostsInLast60Days: 10, noViolationsInDays: 90, maximumFraudScore: 30 },
    manualReview: { minimumRealFollowers: 500, allowsPastViolation: true, allowsBorderlineOrAiHeavyContent: true, maximumRiskScore: 60 },
  };
}

export function buildInitialTrialRules(): TrialRules {
  return { trialLength: "DAYS_7", yearlyDiscountPercent: 20, minimumAccountAgeDays: 7, requiresVerifiedEmail: true, onePerPerson: true, onePerCard: true, onePerDevice: true, maximumRiskScore: 50, minimumCompletedOrders: 0 };
}

export function buildInitialCheckmarkPricing(): CheckmarkPricingRules {
  return {
    bundleDiscountPercent: 15,
    bundleMaximumBusinesses: 3,
    blackGraceDays: 14,
    multiBusinessSingleProfilePercent: 5,
    multiBusinessBasePercent: 10,
    multiBusinessStepPercent: 2,
    multiBusinessMaximumProfiles: 5,
    multiBusinessYearlyExtraPercent: 5,
    multiBusinessYearlyMode: "replace",
  };
}
