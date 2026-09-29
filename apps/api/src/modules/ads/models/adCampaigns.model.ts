import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MoneyDto } from "../../../utils/money.util.js";

export type CampaignObjective = "awareness" | "traffic" | "engagement" | "messages" | "sales" | "followers" | "store_promotion";
export type DeliveryStatus = "draft" | "in_review" | "active" | "paused" | "completed" | "rejected";
export type BudgetType = "daily" | "lifetime";
export type AdPlacement = "feed" | "clips" | "mart" | "search" | "stories" | "live";
export type BidStrategyType = "auto" | "max_cpc" | "max_cpm" | "target_cost";
export type BudgetLevel = "campaign" | "ad_set";
export type PlacementMode = "automatic" | "manual";
export type ReviewStatus = "not_submitted" | "pending" | "approved" | "rejected";
export type AppealStatus = "pending" | "upheld" | "overturned";
export type CampaignOrigin = "ads_manager" | "boost";

export const ALL_AD_PLACEMENTS: readonly AdPlacement[] = ["feed", "clips", "mart", "search", "stories", "live"];

export type CreativeFormat = "feed_post" | "clip" | "product" | "store" | "story" | "live";
export type CreativeSourceType = "post" | "clip" | "product" | "store" | "live" | "upload";
export type CallToAction = "shop_now" | "learn_more" | "visit_store" | "send_message" | "follow" | "watch_more" | "order_now" | "sign_up";
export type DestinationType = "post" | "profile" | "store" | "product" | "messages" | "url";

export interface CreativeMedia {
  readonly id: string;
  readonly kind: "image" | "video";
  readonly url: string;
  readonly posterUrl: string | null;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number | null;
}

export interface CreativeDestination {
  readonly type: DestinationType;
  readonly targetId: string | null;
  readonly url: string | null;
}

export interface CreativeInput {
  readonly format: CreativeFormat;
  readonly source: { readonly type: CreativeSourceType; readonly id: string };
  readonly mediaIds: readonly string[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: CallToAction;
  readonly destination: CreativeDestination;
}

export interface CreativeProduct {
  readonly productId: string;
  readonly title: string;
  readonly price: MoneyDto;
  readonly compareAtPrice: MoneyDto | null;
  readonly rating: number | null;
}

export interface CreativeLiveStream {
  readonly liveSessionId: string;
  readonly status: "scheduled" | "live";
  readonly startsAt: string;
  readonly viewerCount: number;
}

export interface ResolvedCreative {
  readonly format: CreativeFormat;
  readonly source: { readonly type: CreativeSourceType; readonly id: string };
  readonly media: readonly CreativeMedia[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: CallToAction;
  readonly destination: CreativeDestination;
  readonly identity: { readonly name: string; readonly handle: string; readonly avatarUrl: string | null; readonly verifiedBusiness: boolean };
  readonly product: CreativeProduct | null;
  readonly live: CreativeLiveStream | null;
  readonly topics: readonly string[];
}

export interface LocationTarget {
  readonly type: "country" | "state" | "city";
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
  readonly gender: "all" | "female" | "male";
  readonly topicIds: readonly string[];
  readonly behaviourIds: readonly string[];
  readonly customAudienceIds: readonly string[];
  readonly excludedCustomAudienceIds: readonly string[];
}

export interface AdCampaignRecord {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly objective: CampaignObjective;
  readonly status: DeliveryStatus;
  readonly budgetLevel: BudgetLevel;
  readonly budgetType: BudgetType | null;
  readonly budgetMinor: number | null;
  readonly spendCapMinor: number | null;
  readonly currency: CurrencyCode;
  readonly startAt: Date;
  readonly endAt: Date | null;
  readonly origin: CampaignOrigin;
  readonly prepaid: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AdSetRecord {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly name: string;
  readonly status: DeliveryStatus;
  readonly audience: AudienceSpec;
  readonly placementMode: PlacementMode;
  readonly placements: readonly AdPlacement[];
  readonly startAt: Date;
  readonly endAt: Date | null;
  readonly budgetType: BudgetType | null;
  readonly budgetMinor: number | null;
  readonly bidType: BidStrategyType;
  readonly bidMinor: number | null;
  readonly frequencyImpressions: number | null;
  readonly frequencyDays: number | null;
  readonly conversionEventId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AdAppeal {
  readonly status: AppealStatus;
  readonly message: string;
  readonly submittedAt: string;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
}

export interface AdRecord {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly name: string;
  readonly status: DeliveryStatus;
  readonly reviewStatus: ReviewStatus;
  readonly policyCode: string | null;
  readonly policyReason: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewedById: string | null;
  readonly appeal: AdAppeal | null;
  readonly creativeInput: CreativeInput;
  readonly creative: ResolvedCreative;
  readonly deliverablePlacements: readonly AdPlacement[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewAdCampaignInput = Omit<AdCampaignRecord, "id" | "createdAt" | "updatedAt">;
export type AdCampaignChanges = Partial<Omit<AdCampaignRecord, "id" | "accountId" | "objective" | "currency" | "createdAt">>;
export type NewAdSetInput = Omit<AdSetRecord, "id" | "createdAt" | "updatedAt">;
export type AdSetChanges = Partial<Omit<AdSetRecord, "id" | "accountId" | "campaignId" | "createdAt">>;
export type NewAdInput = Omit<AdRecord, "id" | "createdAt" | "updatedAt">;
export type AdChanges = Partial<Omit<AdRecord, "id" | "accountId" | "campaignId" | "adSetId" | "createdAt">>;

export interface DeliverableAd {
  readonly campaign: AdCampaignRecord;
  readonly adSet: AdSetRecord;
  readonly ad: AdRecord;
}
