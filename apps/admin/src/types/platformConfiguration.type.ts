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

export type ConfigurationDocumentKey = "plans" | "revenue" | "creator-eligibility" | "username-rules" | "checkmark-suggestions" | "creator-thresholds" | "trial-rules" | "checkmark-pricing" | "regional-pricing";

export interface PlanPrice {
  readonly currency: string;
  readonly monthly: Money | null;
  readonly yearly: Money | null;
}

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
  readonly prices: readonly PlanPrice[];
}

export interface PlansConfiguration {
  readonly supportedCurrencies: readonly string[];
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
  readonly requiresVerifiedPhone: boolean;
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
  readonly requiresVerifiedPhone: boolean;
  readonly minimumRealFollowers: number;
  readonly minimumOriginalPostsInLast60Days: number;
  readonly noViolationsInDays: number;
  readonly maximumFraudScore: number;
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
  readonly onePerPhone: boolean;
  readonly maximumRiskScore: number;
  readonly minimumCompletedOrders: number;
}

export interface CheckmarkPricingRules {
  readonly bundleDiscountPercent: number;
  readonly bundleMaximumBusinesses: number;
  readonly blueMonthlyPrice: Money;
  readonly goldOnlyMonthlyPrice: Money;
  readonly blackMonthlyPrice: Money;
  readonly blackGraceDays: number;
}

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
}
