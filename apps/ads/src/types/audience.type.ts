import type { AdPlacement, BidStrategy, Budget, CampaignObjective, Schedule } from "@/types/campaign.type";
import type { NumberRange } from "@/types/money.type";

export type LocationType = "country" | "state" | "city";
export type GenderTarget = "all" | "female" | "male";

export interface LocationTarget {
  readonly type: LocationType;
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
  readonly parentName: string | null;
}

export interface AudienceSpec {
  readonly locations: readonly LocationTarget[];
  readonly excludedLocations: readonly LocationTarget[];
  readonly ageMin: number;
  readonly ageMax: number;
  readonly gender: GenderTarget;
  readonly topicIds: readonly string[];
  readonly behaviourIds: readonly string[];
  readonly customAudienceIds: readonly string[];
  readonly excludedCustomAudienceIds: readonly string[];
}

export interface Topic {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface Behaviour {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export type CustomAudienceType = "store_customers" | "engagers" | "followers" | "customer_list" | "lookalike";
export type CustomAudienceStatus = "building" | "ready" | "too_small" | "failed";
export type EngagementSource = "any_post" | "clips_watched" | "live_viewers" | "saved_products" | "messaged";

export interface CustomAudience {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly type: CustomAudienceType;
  readonly status: CustomAudienceStatus;
  readonly approximateSize: NumberRange | null;
  readonly retentionDays: number | null;
  readonly description: string;
  readonly lookalike: { readonly sourceAudienceId: string; readonly countryCode: string; readonly similarityPercent: number } | null;
  readonly usedInAdSetCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type CreateCustomAudienceRequest =
  | { readonly type: "store_customers"; readonly name: string; readonly retentionDays: number; readonly minimumOrders: number }
  | { readonly type: "engagers"; readonly name: string; readonly retentionDays: number; readonly engagementSource: EngagementSource }
  | { readonly type: "followers"; readonly name: string }
  | { readonly type: "lookalike"; readonly name: string; readonly sourceAudienceId: string; readonly countryCode: string; readonly similarityPercent: number };

export type HashedIdentifierType = "email" | "phone";

export interface CustomerListUploadRequest {
  readonly name: string;
  readonly identifierType: HashedIdentifierType;
  readonly hashAlgorithm: "sha256";
  readonly hashedIdentifiers: readonly string[];
}

export interface AudienceEstimateRequest {
  readonly objective: CampaignObjective;
  readonly audience: AudienceSpec;
  readonly placements: readonly AdPlacement[];
  readonly budget: Budget | null;
  readonly bidStrategy: BidStrategy;
  readonly schedule: Schedule;
}

export type AudienceBreadth = "too_narrow" | "narrow" | "balanced" | "broad";

export interface AudienceEstimate {
  readonly audienceSize: NumberRange;
  readonly breadth: AudienceBreadth;
  readonly dailyReach: NumberRange | null;
  readonly dailyResults: NumberRange | null;
  readonly resultLabel: string;
  readonly warnings: readonly string[];
}
