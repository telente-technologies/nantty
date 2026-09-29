import { buildInitialPlansConfiguration } from "@/mocks/seed/configurationPlans.mock";
import type { ConfigurationDocumentContentByKey, CreatorEligibilityRules, RevenueRulesConfiguration, UsernameRules } from "@/types/platformConfiguration.type";

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
    withdrawalFee: { mode: "PASS_THROUGH", note: "We charge exactly what Paystack or Flutterwave charges for the transfer. No Zudomart margin." },
    marketplaceCommission: {
      defaultBasisPoints: 750,
      categoryOverrides: [
        { categorySlug: "fashion", categoryName: "Fashion", basisPoints: 700 },
        { categorySlug: "phones-tablets", categoryName: "Phones & tablets", basisPoints: 450 },
        { categorySlug: "food-groceries", categoryName: "Food & groceries", basisPoints: 500 },
      ],
    },
    loyalty: { isEnabled: true, pointsPerMajorUnitSpent: 1, pointExpiryDays: 365 },
    cashback: {
      isEnabled: true,
      rateBasisPoints: 200,
      capsPerOrder: [
        { amountMinor: 200_000, currency: "NGN" },
        { amountMinor: 2_000, currency: "GHS" },
        { amountMinor: 20_000, currency: "KES" },
      ],
      expiryDays: 90,
    },
    referral: {
      isEnabled: true,
      referrerRewards: [
        { amountMinor: 100_000, currency: "NGN" },
        { amountMinor: 1_000, currency: "GHS" },
      ],
      refereeRewards: [
        { amountMinor: 50_000, currency: "NGN" },
        { amountMinor: 500, currency: "GHS" },
      ],
      qualifyingOrderMinimums: [
        { amountMinor: 500_000, currency: "NGN" },
        { amountMinor: 5_000, currency: "GHS" },
      ],
      maximumReferralsPerMonth: 20,
    },
  };
}

export function buildInitialCreatorEligibilityRules(): CreatorEligibilityRules {
  return { minimumFollowers: 1_000, minimumPostsInLast30Days: 8, maximumActiveStrikes: 0, minimumAccountAgeDays: 30, requiresVerifiedPhone: true, requiresIdentityVerification: true, allowedCountries: ["NG", "GH", "KE", "ZA"] };
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
  ];
}
