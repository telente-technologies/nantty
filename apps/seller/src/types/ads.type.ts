import type { Money } from "@/types/money.type";

export type AdCampaignStatus = "active" | "paused" | "scheduled" | "ended" | "in_review" | "rejected";
export type AdCampaignObjective = "sales" | "traffic" | "awareness" | "followers";

export interface AdPerformanceTotals {
  readonly spend: Money;
  readonly impressions: number;
  readonly clicks: number;
  readonly clickThroughRateBasisPoints: number;
  readonly attributedOrders: number;
  readonly attributedRevenue: Money;
  readonly returnOnAdSpendHundredths: number;
}

export interface AdCampaignSummary extends AdPerformanceTotals {
  readonly id: string;
  readonly name: string;
  readonly objective: AdCampaignObjective;
  readonly placement: string;
  readonly status: AdCampaignStatus;
  readonly dailyBudget: Money;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly manageUrl: string;
}

export interface AdDailyPoint {
  readonly date: string;
  readonly spend: Money;
  readonly attributedRevenue: Money;
  readonly clicks: number;
  readonly impressions: number;
}

export interface AdsSummary {
  readonly from: string;
  readonly to: string;
  readonly hasAdsAccount: boolean;
  readonly adCreditBalance: Money | null;
  readonly totals: AdPerformanceTotals;
  readonly daily: AdDailyPoint[];
  readonly campaigns: AdCampaignSummary[];
}
