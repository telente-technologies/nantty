import type { Money } from "@/types/api.type";
import type { VerificationColor, VerificationTier } from "@/types/platformUser.type";

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

export type ConfigurationDocumentKey = "plans" | "revenue" | "creator-eligibility" | "username-rules";

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

export interface CategoryCommissionOverride {
  readonly categorySlug: string;
  readonly categoryName: string;
  readonly basisPoints: number;
}

export interface RevenueRulesConfiguration {
  readonly supportedCurrencies: readonly string[];
  readonly creatorAdShareBasisPoints: number;
  readonly giftCreatorShareBasisPoints: number;
  readonly giftCreatorShareCeilingBasisPoints: number;
  readonly coinTransferFeeBasisPoints: number;
  readonly coinUnitValues: readonly Money[];
  readonly withdrawalFee: { readonly mode: "PASS_THROUGH"; readonly note: string };
  readonly marketplaceCommission: { readonly defaultBasisPoints: number; readonly categoryOverrides: readonly CategoryCommissionOverride[] };
  readonly loyalty: { readonly isEnabled: boolean; readonly pointsPerMajorUnitSpent: number; readonly pointExpiryDays: number };
  readonly cashback: { readonly isEnabled: boolean; readonly rateBasisPoints: number; readonly capsPerOrder: readonly Money[]; readonly expiryDays: number };
  readonly referral: {
    readonly isEnabled: boolean;
    readonly referrerRewards: readonly Money[];
    readonly refereeRewards: readonly Money[];
    readonly qualifyingOrderMinimums: readonly Money[];
    readonly maximumReferralsPerMonth: number;
  };
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

export interface ConfigurationDocumentContentByKey {
  readonly plans: PlansConfiguration;
  readonly revenue: RevenueRulesConfiguration;
  readonly "creator-eligibility": CreatorEligibilityRules;
  readonly "username-rules": UsernameRules;
}
