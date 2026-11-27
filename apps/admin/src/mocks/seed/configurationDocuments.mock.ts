import { buildInitialPlansConfiguration } from "@/mocks/seed/configurationPlans.mock";
import { buildInitialRegionalPricingDocument } from "@/mocks/seed/regionalPricing.mock";
import { buildInitialCheckmarkPricing, buildInitialCheckmarkSuggestionRules, buildInitialCreatorThresholds, buildInitialTrialRules } from "@/mocks/seed/configurationTrustRules.mock";
import type { ConfigurationDocumentContentByKey, CreatorEligibilityRules, RevenueRulesConfiguration, UsernameRules } from "@/types/platformConfiguration.type";
import { defaultPaymentLimits, defaultSellerDebtLimits } from "@/mocks/handlers/configuration/moneyLimitsValidation.mock";

export function buildInitialRevenueRules(): RevenueRulesConfiguration {
  return {
    supportedCurrencies: ["NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"],
    creatorAdShareBasisPoints: 4000,
    giftCreatorShareBasisPoints: 7000,
    giftCreatorShareCeilingBasisPoints: 7000,
    coinTransferFeeBasisPoints: 2500,
    coinUnitValues: [
      { amountMinor: 1_000, currency: "NGN" },
      { amountMinor: 10, currency: "GHS" },
      { amountMinor: 100, currency: "KES" },
      { amountMinor: 1, currency: "GBP" },
      { amountMinor: 1, currency: "USD" },
    ],
    withdrawalFee: { mode: "PASS_THROUGH", note: "We charge exactly what the payment partner charges for the transfer. No Nantty margin." },
    escrowFee: { defaultBasisPoints: 150, businessPlanBasisPoints: 100 },
  };
}

export function buildInitialCreatorEligibilityRules(): CreatorEligibilityRules {
  return { minimumFollowers: 10_000, minimumVerifiedFollowers: 500, minimumQualifyingImpressionsLast30Days: 100_000, minimumOriginalPosts: 10, minimumOriginalPostsInLast60Days: 10, minimumAccountAgeDays: 30, noViolationsInDays: 90, requiresIdentityVerification: true };
}

export function buildInitialUsernameRules(): UsernameRules {
  return { changesAllowedPerWindow: 1, changeWindowDays: 30, minimumLength: 3, maximumLength: 30, allowedCharacterClasses: ["LOWERCASE_LETTERS", "DIGITS", "DOT", "UNDERSCORE"], mustStartWithLetter: true, releasedUsernameCooldownDays: 14 };
}

export function buildInitialConfigurationDocuments(): { id: keyof ConfigurationDocumentContentByKey; content: ConfigurationDocumentContentByKey[keyof ConfigurationDocumentContentByKey]; changeReason: string }[] {
  return [
    { id: "plans", content: buildInitialPlansConfiguration(), changeReason: "Launch pricing for Nigeria, Ghana, Kenya and South Africa." },
    { id: "revenue", content: buildInitialRevenueRules(), changeReason: "Launch revenue model approved by finance." },
    { id: "creator-eligibility", content: buildInitialCreatorEligibilityRules(), changeReason: "Creator Program launch criteria." },
    { id: "username-rules", content: buildInitialUsernameRules(), changeReason: "Username policy v1." },
    { id: "checkmark-suggestions", content: buildInitialCheckmarkSuggestionRules(), changeReason: "Proposed checkmark suggestion defaults." },
    { id: "creator-thresholds", content: buildInitialCreatorThresholds(), changeReason: "Creator Program eligibility thresholds aligned to the current product policy." },
    { id: "trial-rules", content: buildInitialTrialRules(), changeReason: "Launch trial rules." },
    { id: "checkmark-pricing", content: buildInitialCheckmarkPricing(), changeReason: "Owner pricing: bundle 15%, Gold-only NGN 3,000, Black NGN 50,000." },
    { id: "regional-pricing", content: buildInitialRegionalPricingDocument(), changeReason: "Regional ad floors and creator subscription bands from docs/pricing.md (4 Oct 2026)." },
    { id: "feed.ranking", content: { tierBoostBps: { blue_essential: 10_200, blue_verified: 10_400, premium: 10_600, gold_business: 10_800, black_official: 11_000 }, officialEditorialBoostBps: 11_000 }, changeReason: "Disclosed, capped checkmark and Official boosts (owner rules, 4 Oct 2026)." },
    { id: "appStore.fees", content: { appleFeeBps: 3_000, appleSmallBusinessProgram: false, appleSmallBusinessFeeBps: 1_500, googleSubscriptionFeeBps: 1_500 }, changeReason: "Standard Apple and Google commissions." },
    { id: "seller.debtLimits", content: defaultSellerDebtLimits, changeReason: "Owner-approved seller debt limits by verification level." },
    { id: "payments.limits", content: defaultPaymentLimits, changeReason: "Owner-approved maximum payments and wallet daily limits." },
  ];
}
