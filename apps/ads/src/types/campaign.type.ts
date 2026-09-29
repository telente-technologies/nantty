import type { AudienceSpec } from "@/types/audience.type";
import type { Creative, CreativeInput } from "@/types/creative.type";
import type { Money } from "@/types/money.type";

export type CampaignObjective = "awareness" | "traffic" | "engagement" | "messages" | "sales" | "followers" | "store_promotion";
export type DeliveryStatus = "draft" | "in_review" | "active" | "paused" | "completed" | "rejected";
export type BudgetType = "daily" | "lifetime";
export type AdPlacement = "feed" | "clips" | "mart" | "search" | "stories" | "live";
export type BidStrategyType = "auto" | "max_cpc" | "max_cpm" | "target_cost";
export type BudgetLevel = "campaign" | "ad_set";

export interface Budget {
  readonly type: BudgetType;
  readonly amount: Money;
}

export interface BidStrategy {
  readonly type: BidStrategyType;
  readonly amount: Money | null;
}

export interface FrequencyCap {
  readonly impressions: number;
  readonly perDays: number;
}

export interface Schedule {
  readonly startAt: string;
  readonly endAt: string | null;
}

export interface DeliverySummary {
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  readonly results: number;
  readonly spend: Money;
  readonly costPerResult: Money | null;
  readonly conversionValue: Money;
  readonly spentToday: Money;
}

export interface Campaign {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly objective: CampaignObjective;
  readonly status: DeliveryStatus;
  readonly budgetLevel: BudgetLevel;
  readonly budget: Budget | null;
  readonly spendCap: Money | null;
  readonly schedule: Schedule;
  readonly adSetCount: number;
  readonly adCount: number;
  readonly rejectedAdCount: number;
  readonly delivery: DeliverySummary;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PlacementMode = "automatic" | "manual";

export interface AdSet {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly name: string;
  readonly status: DeliveryStatus;
  readonly audience: AudienceSpec;
  readonly placementMode: PlacementMode;
  readonly placements: readonly AdPlacement[];
  readonly schedule: Schedule;
  readonly budget: Budget | null;
  readonly bidStrategy: BidStrategy;
  readonly frequencyCap: FrequencyCap | null;
  readonly conversionEventId: string | null;
  readonly experimentId: string | null;
  readonly adCount: number;
  readonly delivery: DeliverySummary;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ReviewStatus = "not_submitted" | "pending" | "approved" | "rejected";
export type AppealStatus = "pending" | "upheld" | "overturned";

export interface AdAppeal {
  readonly status: AppealStatus;
  readonly message: string;
  readonly submittedAt: string;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
}

export interface AdReview {
  readonly status: ReviewStatus;
  readonly policyCode: string | null;
  readonly policyReason: string | null;
  readonly reviewedAt: string | null;
  readonly appeal: AdAppeal | null;
}

export interface Ad {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly name: string;
  readonly status: DeliveryStatus;
  readonly review: AdReview;
  readonly creative: Creative;
  readonly delivery: DeliverySummary;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignInput {
  readonly name: string;
  readonly objective: CampaignObjective;
  readonly budgetLevel: BudgetLevel;
  readonly budget: Budget | null;
  readonly spendCap: Money | null;
  readonly schedule: Schedule;
}

export interface AdSetInput {
  readonly name: string;
  readonly audience: AudienceSpec;
  readonly placementMode: PlacementMode;
  readonly placements: readonly AdPlacement[];
  readonly schedule: Schedule;
  readonly budget: Budget | null;
  readonly bidStrategy: BidStrategy;
  readonly frequencyCap: FrequencyCap | null;
  readonly conversionEventId: string | null;
}

export interface AdInput {
  readonly name: string;
  readonly creative: CreativeInput;
}

export interface CampaignDraftSubmission {
  readonly campaign: CampaignInput;
  readonly adSet: AdSetInput;
  readonly ads: readonly AdInput[];
  readonly submitForReview: boolean;
}

export interface CampaignDraftResult {
  readonly campaign: Campaign;
  readonly adSet: AdSet;
  readonly ads: readonly Ad[];
}

export type BulkAction = "pause" | "resume" | "archive" | "duplicate" | "submit_for_review";

export interface BulkActionResult {
  readonly succeededIds: readonly string[];
  readonly failed: readonly { readonly id: string; readonly message: string }[];
}
