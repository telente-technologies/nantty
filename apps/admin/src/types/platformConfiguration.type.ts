import type { Money } from "@/types/api.type";
import type { VerificationColor, VerificationTier } from "@/types/platformUser.type";
import type { RegionalPricingDocument } from "@/types/regionalPricing.type";

export interface VersionAuthor {
  readonly id: string;
  readonly name: string;
}

export interface VersionedRecord<Content> {
  readonly id: string;
  readonly version: number;
  readonly updatedAt: string;
  readonly updatedBy: VersionAuthor;
  readonly changeReason: string;
  readonly isArchived: boolean;
  readonly content: Content;
}

export type ConfigurationDocumentKey = "plans" | "revenue" | "creator-eligibility" | "username-rules" | "checkmark-suggestions" | "creator-thresholds" | "trial-rules" | "checkmark-pricing" | "regional-pricing" | "feed.ranking" | "appStore.fees" | "seller.debtLimits" | "payments.limits";

export interface DashboardEntitlement {
  readonly key: string;
  readonly label: string;
  readonly limit: number | null;
}

export interface VerificationPlan {
  readonly planKey: string;
  readonly color: VerificationColor;
  readonly tier: VerificationTier;
  readonly displayName: string;
  readonly badgeVisible: boolean;
  readonly isPurchasable: boolean;
  readonly perks: readonly string[];
  readonly dashboardEntitlements: readonly DashboardEntitlement[];
  readonly adLoadPercent?: number;
}

export interface PlansConfiguration {
  readonly supportedCurrencies: readonly string[];
  readonly freeAdLoadPercent?: number;
  readonly plans: readonly VerificationPlan[];
}

export interface RevenueRulesConfiguration {
  readonly supportedCurrencies: readonly string[];
  readonly creatorAdShareBasisPoints: number;
  readonly giftCreatorShareBasisPoints: number;
  readonly giftCreatorShareCeilingBasisPoints: number;
  readonly coinTransferFeeBasisPoints: number;
  readonly coinUnitValues: readonly Money[];
  readonly withdrawalFee: { readonly mode: "PASS_THROUGH"; readonly note: string };
  readonly escrowFee: { readonly defaultBasisPoints: number; readonly businessPlanBasisPoints: number };
}

export interface CreatorEligibilityRules {
  readonly minimumFollowers: number;
  readonly minimumPostsInLast30Days: number;
  readonly maximumActiveStrikes: number;
  readonly minimumAccountAgeDays: number;
  readonly requiresIdentityVerification: boolean;
  readonly allowedCountries: readonly string[];
}

export type UsernameCharacterClass = "LOWERCASE_LETTERS" | "DIGITS" | "DOT" | "UNDERSCORE";

export interface UsernameRules {
  readonly changesAllowedPerWindow: number;
  readonly changeWindowDays: number;
  readonly minimumLength: number;
  readonly maximumLength: number;
  readonly allowedCharacterClasses: readonly UsernameCharacterClass[];
  readonly mustStartWithLetter: boolean;
  readonly releasedUsernameCooldownDays: number;
}

export interface CheckmarkSuggestionRules {
  readonly blue: { readonly requiresIdVerified: boolean; readonly minimumAccountAgeDays: number; readonly minimumRealFollowers: number; readonly noViolationsInDays: number };
  readonly gold: { readonly requiresBusinessVerification: boolean; readonly requiresActiveStoreOrBrandPage: boolean; readonly minimumCompletedOrders: number; readonly minimumSuccessRatePercent: number };
}

export interface CreatorAutoApproveRules {
  readonly minimumAccountAgeDays: number;
  readonly requiresVerifiedEmail: boolean;
  readonly minimumRealFollowers: number;
  readonly minimumOriginalPostsInLast60Days: number;
  readonly noViolationsInDays: number;
  readonly maximumFraudScore: number;
  readonly maximumActiveStrikes?: number;
  readonly requiresIdentityVerification?: boolean;
  readonly allowedCountries?: readonly string[];
}

export interface CreatorManualReviewRules {
  readonly minimumRealFollowers: number;
  readonly allowsPastViolation: boolean;
  readonly allowsBorderlineOrAiHeavyContent: boolean;
  readonly maximumRiskScore: number;
}

export interface CreatorProgramThresholds {
  readonly autoApprove: CreatorAutoApproveRules;
  readonly manualReview: CreatorManualReviewRules;
}

export type TrialLength = "DAYS_7" | "MONTH_1";

export interface TrialRules {
  readonly trialLength: TrialLength;
  readonly yearlyDiscountPercent: number;
  readonly minimumAccountAgeDays: number;
  readonly requiresVerifiedEmail: boolean;
  readonly onePerPerson: boolean;
  readonly onePerCard: boolean;
  readonly onePerDevice: boolean;
  readonly maximumRiskScore: number;
  readonly minimumCompletedOrders: number;
}

export interface CheckmarkPricingRules {
  readonly bundleDiscountPercent: number;
  readonly bundleMaximumBusinesses: number;
  readonly blackGraceDays: number;
  readonly multiBusinessSingleProfilePercent?: number;
  readonly multiBusinessBasePercent?: number;
  readonly multiBusinessStepPercent?: number;
  readonly multiBusinessMaximumProfiles?: number;
  readonly multiBusinessYearlyExtraPercent?: number;
  readonly multiBusinessYearlyMode?: MultiBusinessYearlyMode;
}

export type MultiBusinessYearlyMode = "replace" | "add";

export interface ConfigurationDocumentContentByKey {
  readonly plans: PlansConfiguration;
  readonly revenue: RevenueRulesConfiguration;
  readonly "creator-eligibility": CreatorEligibilityRules;
  readonly "username-rules": UsernameRules;
  readonly "checkmark-suggestions": CheckmarkSuggestionRules;
  readonly "creator-thresholds": CreatorProgramThresholds;
  readonly "trial-rules": TrialRules;
  readonly "checkmark-pricing": CheckmarkPricingRules;
  readonly "regional-pricing": RegionalPricingDocument;
  readonly "feed.ranking": import("./ranking.type").FeedRankingPolicy;
  readonly "appStore.fees": AppStoreFeeSettings;
  readonly "seller.debtLimits": SellerDebtLimits;
  readonly "payments.limits": PaymentLimits;
}

export interface DebtLevelAmounts {
  readonly unverified: number;
  readonly payoutVerified: number;
  readonly identityVerified: number;
}

export interface SellerDebtLimits {
  readonly baseMinor: DebtLevelAmounts;
  readonly outsideNigeriaPercent: number;
  readonly trustedSellerAgeDays: number;
  readonly trustedSellerCleanDays: number;
  readonly currencyOverridesMinor: Readonly<Record<string, DebtLevelAmounts>>;
}

export interface WalletDailyAmounts {
  readonly basic: number;
  readonly mid: number;
  readonly full: number;
}

export interface PaymentLimitAmounts {
  readonly orderCheckout: number;
  readonly coinPurchase: number;
  readonly adsTopUp: number;
  readonly adsStepUpAbove?: number;
  readonly walletDaily: WalletDailyAmounts;
}

export interface PaymentLimits {
  readonly baseMinor: PaymentLimitAmounts;
  readonly currencyOverridesMinor: Readonly<Record<string, PaymentLimitAmounts>>;
}

export interface AppStoreFeeSettings {
  readonly appleFeeBps: number;
  readonly appleSmallBusinessProgram: boolean;
  readonly appleSmallBusinessFeeBps: number;
  readonly googleSubscriptionFeeBps: number;
}
