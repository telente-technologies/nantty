import type { ID, ISODate, ProductSummary, StoreSummary } from "./models.type";
import type { Money } from "./money.type";

export interface CreatorEligibilityRequirement {
  readonly key: string;
  readonly label: string;
  readonly currentValue: number;
  readonly requiredValue: number;
  readonly remaining: number;
  readonly met: boolean;
  readonly available: boolean;
  readonly source: string;
  readonly dataAsOf?: ISODate;
}

export type CreatorProgramDecision = "auto_approve" | "manual_review" | "not_eligible" | "unavailable";

export interface CreatorEligibility {
  readonly eligible: boolean;
  readonly decision: CreatorProgramDecision;
  readonly decisionNote: string;
  readonly requirements: readonly CreatorEligibilityRequirement[];
  readonly metricsAvailable: boolean;
  readonly standingAvailable: boolean;
  readonly metricsSource?: string;
  readonly metricsAsOf?: ISODate;
}

export type CreatorContentCategory =
  | "fashion"
  | "beauty"
  | "tech"
  | "food"
  | "lifestyle"
  | "comedy"
  | "music"
  | "education"
  | "fitness"
  | "parenting";

export interface CreatorSocialLink {
  readonly platform: "instagram" | "tiktok" | "youtube" | "x" | "other";
  readonly url: string;
}

export interface CreatorApplicationInput {
  readonly contentCategories: readonly CreatorContentCategory[];
  readonly socialLinks: readonly CreatorSocialLink[];
  readonly sampleContentUrls: readonly string[];
  readonly payoutAccountId?: ID;
  readonly acceptedCreatorTermsVersion: string;
}

export interface CreatorApplication {
  readonly id: ID;
  readonly status: "pending" | "approved" | "rejected";
  readonly contentCategories: readonly CreatorContentCategory[];
  readonly submittedAt: ISODate;
  readonly reviewedAt: ISODate | null;
  readonly rejectionReason: string | null;
  readonly reapplyAvailableAt: ISODate | null;
}

export type CreatorDashboardPeriod = "week" | "month" | "all";

export interface CreatorEarningsBreakdown {
  readonly gifts: Money;
  readonly affiliateCommissions: Money;
  readonly bonuses: Money;
  readonly total: Money;
}

export interface CreatorTopContent {
  readonly id: ID;
  readonly kind: "live" | "post" | "clip";
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly views: number;
  readonly earnings: Money;
}

export interface CreatorDashboard {
  readonly period: CreatorDashboardPeriod;
  readonly earnings: CreatorEarningsBreakdown;
  readonly pendingBalance: Money;
  readonly availableBalance: Money;
  readonly followersGained: number;
  readonly topContent: readonly CreatorTopContent[];
}

export type CreatorAffiliationStatus = "requested" | "active" | "declined";

export interface CreatorAffiliation {
  readonly id: ID;
  readonly store: StoreSummary;
  readonly product: ProductSummary | null;
  readonly commissionPercent: number;
  readonly status: CreatorAffiliationStatus;
  readonly salesCount: number;
  readonly earned: Money;
}

export interface CreatorAffiliationRequest {
  readonly productId?: ID;
  readonly storeId?: ID;
}

export interface CreatorEarning {
  readonly id: ID;
  readonly source: "gift" | "affiliate_commission" | "bonus";
  readonly description: string;
  readonly amount: Money;
  readonly status: "pending" | "available";
  readonly availableAt: ISODate | null;
  readonly createdAt: ISODate;
}

export interface CreatorRevenueRules {
  readonly giftCreatorSharePercentUpTo: number;
  readonly adsRevenueCreatorSharePercent: number;
  readonly coinTransferPlatformFeePercent: number;
  readonly affiliateCommissionReleasedAfterEscrow: boolean;
  readonly withdrawalFeeDescription: string;
}

export interface CreatorSubscriptionPlan {
  readonly id: ID;
  readonly name: string;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly benefits: readonly string[];
  readonly subscriberCount: number;
  readonly active: boolean;
}

export interface CreatorSubscriptionPlanInput {
  readonly name: string;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly benefits: readonly string[];
}

export type CreatorBillingChannel = "web" | "ios" | "android";

export interface CreatorSubscriptionPriceTier {
  readonly tier: string;
  readonly prices: Readonly<Record<CreatorBillingChannel, Money>>;
  readonly default: boolean;
}

export interface CreatorSubscriber {
  readonly id: ID;
  readonly user: import("./models.type").UserSummary;
  readonly planName: string;
  readonly since: ISODate;
  readonly renewsAt: ISODate | null;
}

export interface CreatorSubscriptionCheckout {
  readonly subscriptionId: ID;
  readonly reference: string;
  readonly accessCode: string;
  readonly authorizationUrl: string;
}

export type CreatorSubscriptionStatus = "pending" | "active" | "past_due" | "cancelled" | "expired" | "failed";

export interface CreatorSubscriptionState {
  readonly subscriptionId: ID;
  readonly creatorId: ID;
  readonly planId: ID;
  readonly status: CreatorSubscriptionStatus;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly currentPeriodEnd: ISODate | null;
  readonly renewsAt: ISODate | null;
  readonly billingChannel?: "web" | "apple_iap" | "google_play";
  readonly storeProductId?: string | null;
}
