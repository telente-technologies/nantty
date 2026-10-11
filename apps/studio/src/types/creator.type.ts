import type { ID, ISODate, Money } from "@/types";

export type DashboardPeriod = "today" | "week" | "month" | "all";

export interface CreatorDashboard {
  readonly period: DashboardPeriod;
  readonly since: ISODate | null;
  readonly currency: string;
  readonly earnings: {
    readonly gifts: Money;
    readonly tips: Money;
    readonly affiliateCommissions: Money;
    readonly subscriptions: Money;
    readonly adRevenue: Money;
    readonly bonuses: Money;
    readonly total: Money;
  };
  readonly pendingBalance: Money;
  readonly availableBalance: Money;
  readonly followersGained: number;
  readonly followers: { readonly total: number; readonly gainedInPeriod: number | null };
  readonly coins: { readonly earned: number };
  readonly topContent: readonly { readonly id: ID; readonly kind: string; readonly title: string; readonly thumbnailUrl: string | null; readonly views: number; readonly earnings: Money }[];
}

export type CreatorProgramStatus = "none" | "pending" | "rejected" | "approved" | "suspended" | (string & {});

export interface CreatorStatus {
  readonly status: CreatorProgramStatus;
  readonly canGoLive: boolean;
  readonly tier?: string;
  readonly giftSharePercent: number;
  readonly suspensionReason: string | null;
  readonly suspendedAt: ISODate | null;
  readonly recentViolations: number;
}

export interface RevenueRules {
  readonly giftCreatorSharePercentUpTo: number;
  readonly tipCreatorSharePercent: number;
  readonly subscriptionCreatorSharePercent: number;
  readonly subscriptionShareBasis: string;
  readonly adsRevenueCreatorSharePercent: number;
  readonly coinTransferPlatformFeePercent: number;
  readonly affiliateCommissionReleasedAfterEscrow: boolean;
  readonly affiliateCommissionMaximumPercent: number;
  readonly coinCashValue: Money;
  readonly minimumPayout: Money;
  readonly withdrawalFeeDescription: string;
}

export interface CreatorEarning {
  readonly id: ID;
  readonly kind: string;
  readonly source: string;
  readonly description: string;
  readonly amount: Money;
  readonly grossAmount: Money;
  readonly status: string;
  readonly availableAt: ISODate | null;
  readonly createdAt: ISODate;
  readonly sourceRef: { readonly type: string; readonly id: ID };
}

export interface EligibilityRequirement {
  readonly key: string;
  readonly label: string;
  readonly currentValue: number;
  readonly requiredValue: number;
  readonly met: boolean;
}

export interface CreatorEligibility {
  readonly eligible: boolean;
  readonly decision: string;
  readonly decisionNote: string;
  readonly requirements: readonly EligibilityRequirement[];
}

export interface CreatorApplication {
  readonly id: ID;
  readonly status: string;
  readonly contentCategories: readonly string[];
  readonly submittedAt: ISODate;
  readonly reviewedAt: ISODate | null;
  readonly rejectionReason: string | null;
  readonly reapplyAvailableAt: ISODate | null;
}

export interface BrandDeal {
  readonly id: ID;
  readonly brandName: string;
  readonly amount: Money;
  readonly startsAt: ISODate;
  readonly endsAt: ISODate | null;
  readonly disclosure: string;
  readonly notes: string;
  readonly createdAt: ISODate;
}

export interface BrandDealInput {
  readonly brandName: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly startsAt: ISODate;
  readonly endsAt: ISODate | null;
  readonly disclosure: string;
  readonly notes: string;
}

export interface WithdrawalRecord {
  readonly id: ID;
  readonly amount: Money;
  readonly fee: Money;
  readonly netAmount: Money;
  readonly withdrawalStatus: string;
  readonly reference: string;
  readonly failureReason: string | null;
  readonly createdAt: ISODate;
  readonly processedAt: ISODate | null;
}
